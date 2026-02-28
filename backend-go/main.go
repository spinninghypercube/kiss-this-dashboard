package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	appVersion                = "2.3.6"
	sessionCookieNameDefault = "dash_session"
	defaultSessionTTL        = 315360000
	defaultIconIndexTTL      = 21600
	defaultIconSearchLimit   = 30
)

var (
	validUsernameRe  = regexp.MustCompile(`^[A-Za-z0-9._-]{3,40}$`)
	selfhstRefRe     = regexp.MustCompile(`^[A-Za-z0-9._/-]+$`)
	iconifyNameRe    = regexp.MustCompile(`^[a-z0-9-]+:[a-z0-9][a-z0-9._-]*$`)
	truthyFlagValues = map[string]bool{"y": true, "yes": true, "true": true, "1": true}
)

type envConfig struct {
	Bind               string
	Port               int
	DataDir            string
	PrivateIconsDir    string
	ConfigFile         string
	UsersFile          string
	DefaultConfigPath  string
	AppRoot            string
	SessionTTLSeconds  int
	SessionCookieName  string
	SessionsFile       string
	IconIndexTTL       int
	IconSearchMaxLimit int
	SelfhstIndexURL    string
	SelfhstRawBase     string
	IconifyAPIBase     string
}

type sessionInfo struct {
	Username string
	Expires  int64
}

type selfhstIcon struct {
	Name      string `json:"name"`
	Reference string `json:"reference"`
	Category  string `json:"category"`
	Tags      string `json:"tags"`
	HasSVG    bool   `json:"hasSvg"`
	HasPNG    bool   `json:"hasPng"`
	HasWebP   bool   `json:"hasWebp"`
	HasLight  bool   `json:"hasLight"`
	HasDark   bool   `json:"hasDark"`
}

type iconSearchResult struct {
	Score     int    `json:"score,omitempty"`
	Name      string `json:"name"`
	Reference string `json:"reference"`
	Category  string `json:"category"`
	Tags      string `json:"tags"`
	HasSVG    bool   `json:"hasSvg,omitempty"`
	HasPNG    bool   `json:"hasPng,omitempty"`
	HasWebP   bool   `json:"hasWebp,omitempty"`
	HasLight  bool   `json:"hasLight,omitempty"`
	HasDark   bool   `json:"hasDark,omitempty"`
	PreviewURL string `json:"previewUrl"`
	Source    string `json:"source,omitempty"`
}

type iconCache struct {
	FetchedAt int64
	Items     []selfhstIcon
}

type app struct {
	cfg      envConfig
	client   *http.Client
	fileMu   sync.Mutex
	sessMu   sync.Mutex
	sessions map[string]sessionInfo
	iconMu   sync.Mutex
	iconIdx  iconCache
}

func main() {
	cfg := loadEnv()
	a := &app{
		cfg:      cfg,
		client:   &http.Client{Timeout: 20 * time.Second},
		sessions: map[string]sessionInfo{},
	}
	if err := a.ensureFilesReady(); err != nil {
		log.Fatalf("failed to initialize data files: %v", err)
	}
	a.loadSessions()

	addr := fmt.Sprintf("%s:%d", cfg.Bind, cfg.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           a,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("KISS Startpage v%s — listening on http://%s", appVersion, addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}

func loadEnv() envConfig {
	exe, _ := os.Executable()
	defaultAppRoot := filepath.Dir(filepath.Dir(exe))
	if defaultAppRoot == "." || defaultAppRoot == "/" {
		defaultAppRoot = cwdOrFallback()
	}
	dataDir := getenv("DASH_DATA_DIR", "/srv/www/kiss-startpage/shared/data")
	privateIconsDir := getenv("DASH_PRIVATE_ICONS_DIR", filepath.Join(filepath.Dir(dataDir), "private-icons"))
	appRoot := getenv("DASH_APP_ROOT", defaultAppRoot)
	return envConfig{
		Bind:               getenv("DASH_BIND", "127.0.0.1"),
		Port:               getenvInt("DASH_PORT", 8788),
		DataDir:            dataDir,
		PrivateIconsDir:    privateIconsDir,
		ConfigFile:         filepath.Join(dataDir, "dashboard-config.json"),
		UsersFile:          filepath.Join(dataDir, "users.json"),
		DefaultConfigPath:  getenv("DASH_DEFAULT_CONFIG", "/srv/www/kiss-startpage/current/startpage-default-config.json"),
		AppRoot:            appRoot,
		SessionTTLSeconds:  getenvInt("DASH_SESSION_TTL", defaultSessionTTL),
		SessionCookieName:  sessionCookieNameDefault,
		SessionsFile:       filepath.Join(dataDir, "sessions.json"),
		IconIndexTTL:       getenvInt("DASH_ICON_INDEX_TTL", defaultIconIndexTTL),
		IconSearchMaxLimit: getenvInt("DASH_ICON_SEARCH_MAX_LIMIT", defaultIconSearchLimit),
		SelfhstIndexURL:    getenv("DASH_ICON_INDEX_URL", "https://raw.githubusercontent.com/selfhst/icons/main/index.json"),
		SelfhstRawBase:     getenv("DASH_ICON_RAW_BASE", "https://raw.githubusercontent.com/selfhst/icons/main"),
		IconifyAPIBase:     getenv("DASH_ICONIFY_API_BASE", "https://api.iconify.design"),
	}
}

func cwdOrFallback() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return cwd
}

func getenv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func getenvInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func (a *app) ensureFilesReady() error {
	if err := os.MkdirAll(a.cfg.DataDir, 0o750); err != nil {
		return err
	}
	a.fileMu.Lock()
	defer a.fileMu.Unlock()

	if _, err := os.Stat(a.cfg.ConfigFile); errors.Is(err, os.ErrNotExist) {
		cfg, ok := readJSONAny(a.cfg.DefaultConfigPath)
		if !ok {
			cfg = map[string]any{
				"title": "KISS Startpage",
				"dashboards": []any{
					map[string]any{
						"id":     "dashboard-1",
						"label":  "Startpage 1",
						"groups": []any{},
					},
				},
			}
		}
		if err := writeJSONAtomic(a.cfg.ConfigFile, normalizeConfig(cfg)); err != nil {
			return err
		}
	}

	if _, err := os.Stat(a.cfg.UsersFile); errors.Is(err, os.ErrNotExist) {
		if err := writeJSONAtomic(a.cfg.UsersFile, map[string]any{"users": map[string]any{}}); err != nil {
			return err
		}
	}
	return nil
}

func readJSONAny(path string) (any, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, false
	}
	return v, true
}

func writeJSONAtomic(path string, payload any) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	enc := json.NewEncoder(tmp)
	enc.SetIndent("", "  ")
	if err := enc.Encode(payload); err != nil {
		tmp.Close()
		_ = os.Remove(tmpName)
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return err
	}
	return os.Rename(tmpName, path)
}

func normalizeConfig(v any) map[string]any {
	m, ok := v.(map[string]any)
	if !ok {
		return map[string]any{
			"title":       "KISS Startpage",
			"themePresets": []any{},
			"dashboards":  []any{},
		}
	}
	out := map[string]any{}
	for k, val := range m {
		out[k] = val
	}
	title := strings.TrimSpace(asString(out["title"]))
	if title == "" {
		title = "KISS Startpage"
	}
	out["title"] = title
	if _, ok := out["themePresets"].([]any); !ok {
		if out["themePresets"] == nil {
			out["themePresets"] = []any{}
		}
	}
	if _, ok := out["dashboards"].([]any); !ok {
		out["dashboards"] = []any{}
	}
	return out
}

func asString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (a *app) getUsersPayload() map[string]any {
	a.fileMu.Lock()
	defer a.fileMu.Unlock()
	v, ok := readJSONAny(a.cfg.UsersFile)
	if !ok {
		return map[string]any{"users": map[string]any{}}
	}
	m, ok := v.(map[string]any)
	if !ok {
		return map[string]any{"users": map[string]any{}}
	}
	if _, ok := m["users"].(map[string]any); !ok {
		m["users"] = map[string]any{}
	}
	return m
}

func (a *app) saveUsersPayload(payload map[string]any) error {
	a.fileMu.Lock()
	defer a.fileMu.Unlock()
	return writeJSONAtomic(a.cfg.UsersFile, payload)
}

func (a *app) getConfigPayload() map[string]any {
	a.fileMu.Lock()
	defer a.fileMu.Unlock()
	v, ok := readJSONAny(a.cfg.ConfigFile)
	if !ok {
		return normalizeConfig(nil)
	}
	return normalizeConfig(v)
}

func (a *app) saveConfigPayload(cfg any) (map[string]any, error) {
	norm := normalizeConfig(cfg)
	a.fileMu.Lock()
	defer a.fileMu.Unlock()
	if err := writeJSONAtomic(a.cfg.ConfigFile, norm); err != nil {
		return nil, err
	}
	return norm, nil
}

func usersMap(payload map[string]any) map[string]any {
	users, _ := payload["users"].(map[string]any)
	if users == nil {
		users = map[string]any{}
		payload["users"] = users
	}
	return users
}

func hasAnyUsers(payload map[string]any) bool {
	for k := range usersMap(payload) {
		if strings.TrimSpace(k) != "" {
			return true
		}
	}
	return false
}

func validUsername(username string) bool {
	return validUsernameRe.MatchString(username)
}

func hashPassword(password, saltHex string, iterations int) (string, error) {
	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return "", err
	}
	digest := pbkdf2SHA256([]byte(password), salt, iterations, 32)
	return hex.EncodeToString(digest), nil
}

func buildPasswordRecord(password string) (map[string]any, error) {
	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return nil, err
	}
	saltHex := hex.EncodeToString(saltBytes)
	iterations := 210000
	hashed, err := hashPassword(password, saltHex, iterations)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"salt":       saltHex,
		"iterations": iterations,
		"hash":       hashed,
	}, nil
}

func verifyPassword(password string, record any) bool {
	m, ok := record.(map[string]any)
	if !ok {
		return false
	}
	salt, _ := m["salt"].(string)
	hashStr, _ := m["hash"].(string)
	iter := asInt(m["iterations"], 210000)
	if salt == "" || hashStr == "" {
		return false
	}
	calculated, err := hashPassword(password, salt, iter)
	if err != nil {
		return false
	}
	return hmac.Equal([]byte(calculated), []byte(hashStr))
}

func userRequiresPasswordChange(payload map[string]any, username string) bool {
	rec, ok := usersMap(payload)[username].(map[string]any)
	if !ok {
		return false
	}
	v, _ := rec["mustChangePassword"].(bool)
	return v
}

func (a *app) isPasswordChangeRequired(username string) bool {
	return userRequiresPasswordChange(a.getUsersPayload(), username)
}

func clearPasswordChangeRequired(payload map[string]any, username string) bool {
	rec, ok := usersMap(payload)[username].(map[string]any)
	if !ok {
		return false
	}
	v, _ := rec["mustChangePassword"].(bool)
	if !v {
		return false
	}
	rec["mustChangePassword"] = false
	usersMap(payload)[username] = rec
	return true
}

func asInt(v any, fallback int) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case int64:
		return int(t)
	case json.Number:
		n, err := t.Int64()
		if err == nil {
			return int(n)
		}
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err == nil {
			return n
		}
	}
	return fallback
}

func pbkdf2SHA256(password, salt []byte, iter, keyLen int) []byte {
	hLen := 32
	numBlocks := (keyLen + hLen - 1) / hLen
	var out []byte
	for block := 1; block <= numBlocks; block++ {
		u := hmacSHA256(password, append(append([]byte{}, salt...), uint32BE(uint32(block))...))
		t := append([]byte{}, u...)
		for i := 1; i < iter; i++ {
			u = hmacSHA256(password, u)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}

func hmacSHA256(key, msg []byte) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write(msg)
	return h.Sum(nil)
}

func uint32BE(v uint32) []byte {
	var b [4]byte
	binary.BigEndian.PutUint32(b[:], v)
	return b[:]
}

func (a *app) loadSessions() {
	raw, err := os.ReadFile(a.cfg.SessionsFile)
	if err != nil {
		return // file doesn't exist yet, start fresh
	}
	var sessions map[string]sessionInfo
	if err := json.Unmarshal(raw, &sessions); err != nil {
		log.Printf("warn: could not parse sessions file: %v", err)
		return
	}
	a.sessMu.Lock()
	defer a.sessMu.Unlock()
	now := time.Now().Unix()
	for token, s := range sessions {
		if s.Expires > now {
			a.sessions[token] = s
		}
	}
}

func (a *app) saveSessionsLocked() {
	data, err := json.Marshal(a.sessions)
	if err != nil {
		log.Printf("warn: could not marshal sessions: %v", err)
		return
	}
	if err := os.WriteFile(a.cfg.SessionsFile, data, 0600); err != nil {
		log.Printf("warn: could not save sessions: %v", err)
	}
}

func (a *app) pruneSessionsLocked() {
	now := time.Now().Unix()
	for token, s := range a.sessions {
		if s.Expires <= now {
			delete(a.sessions, token)
		}
	}
}

func (a *app) createSession(username string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	a.sessMu.Lock()
	defer a.sessMu.Unlock()
	a.pruneSessionsLocked()
	a.sessions[token] = sessionInfo{
		Username: username,
		Expires:  time.Now().Unix() + int64(a.cfg.SessionTTLSeconds),
	}
	a.saveSessionsLocked()
	return token, nil
}

func (a *app) resolveSessionUsername(r *http.Request) string {
	cookie, err := r.Cookie(a.cfg.SessionCookieName)
	if err != nil || cookie == nil || cookie.Value == "" {
		return ""
	}
	a.sessMu.Lock()
	defer a.sessMu.Unlock()
	a.pruneSessionsLocked()
	s, ok := a.sessions[cookie.Value]
	if !ok {
		return ""
	}
	s.Expires = time.Now().Unix() + int64(a.cfg.SessionTTLSeconds)
	a.sessions[cookie.Value] = s
	return s.Username
}

func (a *app) removeSession(r *http.Request) {
	cookie, err := r.Cookie(a.cfg.SessionCookieName)
	if err != nil || cookie == nil || cookie.Value == "" {
		return
	}
	a.sessMu.Lock()
	delete(a.sessions, cookie.Value)
	a.saveSessionsLocked()
	a.sessMu.Unlock()
}

func (a *app) updateSessionUsername(r *http.Request, oldUsername, newUsername string) {
	cookie, err := r.Cookie(a.cfg.SessionCookieName)
	if err != nil || cookie == nil || cookie.Value == "" {
		return
	}
	a.sessMu.Lock()
	defer a.sessMu.Unlock()
	a.pruneSessionsLocked()
	s, ok := a.sessions[cookie.Value]
	if !ok || s.Username != oldUsername {
		return
	}
	s.Username = newUsername
	a.sessions[cookie.Value] = s
	a.saveSessionsLocked()
}

func (a *app) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     a.cfg.SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   a.cfg.SessionTTLSeconds,
	})
}

func (a *app) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     a.cfg.SessionCookieName,
		Value:    "deleted",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   0,
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	raw, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(raw)))
	w.WriteHeader(status)
	_, _ = w.Write(raw)
}

func writeBytes(w http.ResponseWriter, status int, body []byte, contentType string) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func redirectNoStore(w http.ResponseWriter, location string, status int) {
	w.Header().Set("Location", location)
	w.Header().Set("Content-Length", "0")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
}

func readJSONBody(r *http.Request) (map[string]any, bool, bool) {
	if r.Body == nil {
		return map[string]any{}, true, false
	}
	defer r.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(r.Body, 10<<20))
	if err != nil {
		return nil, false, false
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return map[string]any{}, true, false
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, false, true
	}
	if payload == nil {
		payload = map[string]any{}
	}
	return payload, true, false
}

func (a *app) requireAuth(w http.ResponseWriter, r *http.Request, requirePasswordChanged bool) (string, bool) {
	username := a.resolveSessionUsername(r)
	if username == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"message": "Authentication required."})
		return "", false
	}
	if requirePasswordChanged && a.isPasswordChangeRequired(username) {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"message": "First-time setup required: change the account password before editing the startpage.",
		})
		return "", false
	}
	return username, true
}

func (a *app) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	switch r.Method {
	case http.MethodGet:
		a.handleGET(w, r, path)
	case http.MethodPost:
		a.handlePOST(w, r, path)
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
	}
}

func (a *app) handleGET(w http.ResponseWriter, r *http.Request, path string) {
	switch path {
	case "/health":
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	case "/api/version":
		writeJSON(w, http.StatusOK, map[string]any{"version": appVersion})
		return
	case "/api/config":
		writeJSON(w, http.StatusOK, map[string]any{"config": a.getConfigPayload()})
		return
	case "/api/auth/status":
		username := a.resolveSessionUsername(r)
		if username != "" {
			writeJSON(w, http.StatusOK, map[string]any{
				"authenticated":      true,
				"username":           username,
				"mustChangePassword": a.isPasswordChangeRequired(username),
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"authenticated": false,
			"setupRequired": !hasAnyUsers(a.getUsersPayload()),
		})
		return
	case "/api/icons/search":
		if _, ok := a.requireAuth(w, r, true); !ok {
			return
		}
		a.handleIconSearch(w, r)
		return
	default:
		if a.servePrivateIcon(w, r, path) {
			return
		}
		if a.serveStatic(w, r) {
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
		return
	}
}

func (a *app) handlePOST(w http.ResponseWriter, r *http.Request, path string) {
	payload, ok, invalid := readJSONBody(r)
	if !ok {
		if invalid {
			writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Invalid JSON body."})
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Failed to read request body."})
		}
		return
	}
	switch path {
	case "/api/auth/bootstrap":
		a.handleBootstrap(w, r, payload)
	case "/api/login":
		a.handleLogin(w, r, payload)
	case "/api/logout":
		a.removeSession(r)
		a.clearSessionCookie(w)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	case "/api/config":
		a.handleSaveConfig(w, r, payload)
	case "/api/auth/change-username":
		a.handleChangeUsername(w, r, payload)
	case "/api/auth/change-password":
		a.handleChangePassword(w, r, payload)
	case "/api/icons/import-selfhst":
		a.handleImportSelfhst(w, r, payload)
	case "/api/icons/import-iconify":
		a.handleImportIconify(w, r, payload)
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
	}
}

func (a *app) handleBootstrap(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	usersPayload := a.getUsersPayload()
	if hasAnyUsers(usersPayload) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"message":       "An admin account is already configured.",
			"setupRequired": false,
		})
		return
	}
	username := strings.TrimSpace(asString(payload["username"]))
	password := asString(payload["password"])
	if !validUsername(username) {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"message": "Username must be 3-40 chars and use only letters, numbers, dot, dash or underscore.",
		})
		return
	}
	if len(password) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Password must be at least 4 characters."})
		return
	}
	rec, err := buildPasswordRecord(password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to create account."})
		return
	}
	users := usersMap(usersPayload)
	if len(users) > 0 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"message":       "An admin account is already configured.",
			"setupRequired": false,
		})
		return
	}
	users[username] = rec
	usersPayload["users"] = users
	if err := a.saveUsersPayload(usersPayload); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to save users."})
		return
	}
	token, err := a.createSession(username)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to create session."})
		return
	}
	a.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"username":          username,
		"mustChangePassword": false,
		"setupRequired":     false,
	})
}

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	username := strings.TrimSpace(asString(payload["username"]))
	password := asString(payload["password"])
	if username == "" || password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Username and password are required."})
		return
	}
	usersPayload := a.getUsersPayload()
	if !hasAnyUsers(usersPayload) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"message":       "No admin account configured yet. Complete first-time setup.",
			"setupRequired": true,
		})
		return
	}
	rec := usersMap(usersPayload)[username]
	if !verifyPassword(password, rec) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"message": "Invalid username or password."})
		return
	}
	token, err := a.createSession(username)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to create session."})
		return
	}
	a.setSessionCookie(w, token)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"username":          username,
		"mustChangePassword": userRequiresPasswordChange(usersPayload, username),
	})
}

func (a *app) handleSaveConfig(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	username, ok := a.requireAuth(w, r, true)
	if !ok {
		return
	}
	cfg, hasCfg := payload["config"]
	if !hasCfg {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Missing config payload."})
		return
	}
	saved, err := a.saveConfigPayload(cfg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to save config."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"savedBy": username,
		"config":  saved,
	})
}

func (a *app) handleChangeUsername(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	username, ok := a.requireAuth(w, r, false)
	if !ok {
		return
	}
	currentPassword := asString(payload["currentPassword"])
	newUsername := strings.TrimSpace(asString(payload["newUsername"]))
	if !validUsername(newUsername) {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"message": "Username must be 3-40 chars and use only letters, numbers, dot, dash or underscore.",
		})
		return
	}
	usersPayload := a.getUsersPayload()
	users := usersMap(usersPayload)
	rec := users[username]
	if !verifyPassword(currentPassword, rec) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"message": "Current password is incorrect."})
		return
	}
	if newUsername != username {
		if _, exists := users[newUsername]; exists {
			writeJSON(w, http.StatusConflict, map[string]any{"message": "Username already exists."})
			return
		}
		users[newUsername] = users[username]
		delete(users, username)
		usersPayload["users"] = users
		if err := a.saveUsersPayload(usersPayload); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to save users."})
			return
		}
		a.updateSessionUsername(r, username, newUsername)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": newUsername})
}

func (a *app) handleChangePassword(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	username, ok := a.requireAuth(w, r, false)
	if !ok {
		return
	}
	currentPassword := asString(payload["currentPassword"])
	newPassword := asString(payload["newPassword"])
	if len(newPassword) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "New password must be at least 4 characters."})
		return
	}
	usersPayload := a.getUsersPayload()
	users := usersMap(usersPayload)
	rec := users[username]
	if !verifyPassword(currentPassword, rec) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"message": "Current password is incorrect."})
		return
	}
	newRec, err := buildPasswordRecord(newPassword)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to update password."})
		return
	}
	users[username] = newRec
	usersPayload["users"] = users
	clearPasswordChangeRequired(usersPayload, username)
	if err := a.saveUsersPayload(usersPayload); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to save users."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mustChangePassword": false})
}

func (a *app) serveStatic(w http.ResponseWriter, r *http.Request) bool {
	rawPath := r.URL.Path
	querySuffix := ""
	if r.URL.RawQuery != "" {
		querySuffix = "?" + r.URL.RawQuery
	}
	switch rawPath {
	case "/index.html":
		redirectNoStore(w, "/"+querySuffix, http.StatusFound)
		return true
	case "/admin.html", "/admin", "/edit.html":
		redirectNoStore(w, "/edit"+querySuffix, http.StatusFound)
		return true
	case "/edit/":
		redirectNoStore(w, "/edit"+querySuffix, http.StatusFound)
		return true
	}

	relative := ""
	switch {
	case rawPath == "/edit":
		relative = "index.html"
	case rawPath == "/" || rawPath == "":
		relative = "index.html"
	default:
		relative = strings.TrimPrefix(rawPath, "/")
		if strings.HasSuffix(rawPath, "/") {
			relative = strings.TrimSuffix(relative, "/") + "/index.html"
		}
	}
	relative = filepath.ToSlash(filepath.Clean(relative))
	relative = strings.TrimPrefix(relative, "/")
	if relative == "." || relative == "" {
		relative = "index.html"
	}
	if strings.HasPrefix(relative, "backend/") ||
		strings.HasPrefix(relative, "ops/") ||
		strings.HasPrefix(relative, ".") ||
		strings.Contains(relative, "/.") ||
		relative == ".." ||
		strings.HasPrefix(relative, "../") {
		return false
	}
	ext := strings.ToLower(filepath.Ext(relative))
	allowed := map[string]bool{
		".html": true, ".js": true, ".json": true, ".css": true, ".svg": true,
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
		".ico": true, ".txt": true,
	}
	if !allowed[ext] {
		return false
	}
	appRoot, err := filepath.Abs(a.cfg.AppRoot)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to resolve app root."})
		return true
	}
	filePath, err := filepath.Abs(filepath.Join(appRoot, relative))
	if err != nil {
		return false
	}
	if filePath != appRoot && !strings.HasPrefix(filePath, appRoot+string(os.PathSeparator)) {
		return false
	}
	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		return false
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to read static file."})
		return true
	}
	contentType := mime.TypeByExtension(ext)
	switch ext {
	case ".js":
		contentType = "application/javascript; charset=utf-8"
	case ".html":
		contentType = "text/html; charset=utf-8"
	case ".json":
		contentType = "application/json; charset=utf-8"
	case ".css":
		contentType = "text/css; charset=utf-8"
	default:
		if strings.HasPrefix(contentType, "text/") {
			contentType += "; charset=utf-8"
		}
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	writeBytes(w, http.StatusOK, raw, contentType)
	return true
}

func (a *app) servePrivateIcon(w http.ResponseWriter, r *http.Request, rawPath string) bool {
	if !strings.HasPrefix(rawPath, "/icons/") {
		return false
	}
	name, err := url.PathUnescape(strings.TrimPrefix(rawPath, "/icons/"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Invalid icon path."})
		return true
	}
	name = strings.TrimSpace(name)
	if name == "" ||
		strings.Contains(name, "/") ||
		strings.Contains(name, "\\") ||
		strings.Contains(name, "..") ||
		strings.HasPrefix(name, ".") {
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
		return true
	}
	ext := strings.ToLower(filepath.Ext(name))
	allowed := map[string]bool{
		".svg": true, ".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".ico": true,
	}
	if !allowed[ext] {
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
		return true
	}
	iconRoot, err := filepath.Abs(a.cfg.PrivateIconsDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to resolve icon path."})
		return true
	}
	filePath, err := filepath.Abs(filepath.Join(iconRoot, name))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
		return true
	}
	if filePath != iconRoot && !strings.HasPrefix(filePath, iconRoot+string(os.PathSeparator)) {
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
		return true
	}
	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		writeJSON(w, http.StatusNotFound, map[string]any{"message": "Not found."})
		return true
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"message": "Failed to read icon file."})
		return true
	}
	contentType := mime.TypeByExtension(ext)
	if ext == ".svg" {
		contentType = "image/svg+xml"
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	writeBytes(w, http.StatusOK, raw, contentType)
	return true
}

func (a *app) httpGet(target string, timeout time.Duration) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "kiss-startpage-go/0.1 (+selfhst-icons)")
	req.Header.Set("Accept", "application/json, image/svg+xml, image/png;q=0.9, */*;q=0.8")
	client := *a.client
	client.Timeout = timeout
	return client.Do(req)
}

func normalizeBoolFlag(v any) bool {
	s := strings.ToLower(strings.TrimSpace(asString(v)))
	return truthyFlagValues[s]
}

func (a *app) getSelfhstIconIndex() ([]selfhstIcon, error) {
	now := time.Now().Unix()
	a.iconMu.Lock()
	cache := a.iconIdx
	a.iconMu.Unlock()
	if len(cache.Items) > 0 && now-cache.FetchedAt < int64(a.cfg.IconIndexTTL) {
		return cache.Items, nil
	}
	resp, err := a.httpGet(a.cfg.SelfhstIndexURL, 20*time.Second)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("icon index source error (%d)", resp.StatusCode)
	}
	var rows []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, err
	}
	items := make([]selfhstIcon, 0, len(rows))
	for _, row := range rows {
		ref := strings.TrimSpace(asString(row["Reference"]))
		if ref == "" {
			continue
		}
		name := strings.TrimSpace(asString(row["Name"]))
		if name == "" {
			name = ref
		}
		items = append(items, selfhstIcon{
			Name:      name,
			Reference: ref,
			Category:  strings.TrimSpace(asString(row["Category"])),
			Tags:      strings.TrimSpace(asString(row["Tags"])),
			HasSVG:    normalizeBoolFlag(row["SVG"]),
			HasPNG:    normalizeBoolFlag(row["PNG"]),
			HasWebP:   normalizeBoolFlag(row["WebP"]),
			HasLight:  normalizeBoolFlag(row["Light"]),
			HasDark:   normalizeBoolFlag(row["Dark"]),
		})
	}
	a.iconMu.Lock()
	a.iconIdx = iconCache{FetchedAt: now, Items: items}
	a.iconMu.Unlock()
	return items, nil
}

func (a *app) handleIconSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	source := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("source")))
	if source == "" {
		source = "selfhst"
	}
	limit := asInt(r.URL.Query().Get("limit"), 20)
	if limit < 1 {
		limit = 1
	}
	if limit > a.cfg.IconSearchMaxLimit {
		limit = a.cfg.IconSearchMaxLimit
	}
	if len(q) < 2 {
		writeJSON(w, http.StatusOK, map[string]any{
			"items":   []any{},
			"query":   q,
			"message": "Enter at least 2 characters.",
		})
		return
	}
	var (
		items []iconSearchResult
		err   error
	)
	switch source {
	case "iconify-simple":
		items, err = a.searchIconifyIcons(q, limit, "simple-icons", "iconify-simple", "Simple Icons")
	case "iconify-logos":
		items, err = a.searchIconifyIcons(q, limit, "logos", "iconify-logos", "Logos")
	default:
		source = "selfhst"
		items, err = a.searchSelfhstIcons(q, limit)
	}
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"message": fmt.Sprintf("Icon search source unavailable: %v", err)})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"query":  q,
		"items":  items,
		"source": source,
	})
}

func (a *app) searchSelfhstIcons(query string, limit int) ([]iconSearchResult, error) {
	items, err := a.getSelfhstIconIndex()
	if err != nil {
		return nil, err
	}
	nq := strings.ToLower(strings.TrimSpace(query))
	tokens := strings.Fields(nq)
	results := make([]iconSearchResult, 0, len(items))
	for _, item := range items {
		name := strings.ToLower(item.Name)
		ref := strings.ToLower(item.Reference)
		cat := strings.ToLower(item.Category)
		tags := strings.ToLower(item.Tags)
		haystack := name + " " + ref + " " + cat + " " + tags
		if nq != "" && !strings.Contains(haystack, nq) {
			continue
		}
		score := 0
		if ref == nq {
			score += 1200
		} else if strings.HasPrefix(ref, nq) {
			score += 900
		}
		if name == nq {
			score += 1000
		} else if strings.HasPrefix(name, nq) {
			score += 800
		}
		if strings.Contains(name, nq) {
			score += 500
		}
		if strings.Contains(ref, nq) {
			score += 450
		}
		if strings.Contains(tags, nq) {
			score += 220
		}
		if strings.Contains(cat, nq) {
			score += 120
		}
		for _, tok := range tokens {
			if strings.Contains(name, tok) {
				score += 80
			}
			if strings.Contains(ref, tok) {
				score += 70
			}
			if strings.Contains(tags, tok) {
				score += 35
			}
		}
		previewExt := ""
		if item.HasSVG {
			previewExt = "svg"
		} else if item.HasPNG {
			previewExt = "png"
		}
		previewURL := ""
		if previewExt != "" {
			previewURL = fmt.Sprintf("%s/%s/%s.%s", a.cfg.SelfhstRawBase, previewExt, url.PathEscape(item.Reference), previewExt)
		}
		results = append(results, iconSearchResult{
			Score:      score,
			Name:       item.Name,
			Reference:  item.Reference,
			Category:   item.Category,
			Tags:       item.Tags,
			HasSVG:     item.HasSVG,
			HasPNG:     item.HasPNG,
			HasWebP:    item.HasWebP,
			HasLight:   item.HasLight,
			HasDark:    item.HasDark,
			PreviewURL: previewURL,
		})
	}
	sort.Slice(results, func(i, j int) bool {
		if results[i].Score != results[j].Score {
			return results[i].Score > results[j].Score
		}
		if strings.ToLower(results[i].Name) != strings.ToLower(results[j].Name) {
			return strings.ToLower(results[i].Name) < strings.ToLower(results[j].Name)
		}
		return strings.ToLower(results[i].Reference) < strings.ToLower(results[j].Reference)
	})
	if len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}

func (a *app) searchIconifyIcons(query string, limit int, iconPrefix, sourceID, categoryLabel string) ([]iconSearchResult, error) {
	if len(strings.TrimSpace(query)) < 2 {
		return []iconSearchResult{}, nil
	}
	searchURL := fmt.Sprintf("%s/search?query=%s&limit=%d&prefixes=%s",
		strings.TrimRight(a.cfg.IconifyAPIBase, "/"),
		url.QueryEscape(strings.TrimSpace(query)),
		limit,
		url.QueryEscape(iconPrefix),
	)
	resp, err := a.httpGet(searchURL, 20*time.Second)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("iconify search error (%d)", resp.StatusCode)
	}
	var parsed map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	var icons []any
	if arr, ok := parsed["icons"].([]any); ok {
		icons = arr
	}
	results := []iconSearchResult{}
	for _, rawName := range icons {
		iconName, ok := rawName.(string)
		if !ok || !strings.Contains(iconName, ":") {
			continue
		}
		parts := strings.SplitN(iconName, ":", 2)
		if len(parts) != 2 || parts[0] != iconPrefix || parts[1] == "" {
			continue
		}
		name := parts[1]
		label := strings.Title(strings.ReplaceAll(name, "-", " "))
		previewURL := fmt.Sprintf("%s/%s/%s.svg",
			strings.TrimRight(a.cfg.IconifyAPIBase, "/"),
			url.PathEscape(parts[0]),
			url.PathEscape(name),
		)
		results = append(results, iconSearchResult{
			Name:       label,
			Reference:  iconName,
			Category:   categoryLabel,
			Tags:       "",
			PreviewURL: previewURL,
			Source:     sourceID,
		})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

func (a *app) handleImportSelfhst(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	if _, ok := a.requireAuth(w, r, true); !ok {
		return
	}
	ref := strings.TrimSpace(asString(payload["reference"]))
	preferFormat := strings.ToLower(strings.TrimSpace(asString(payload["format"])))
	if preferFormat != "png" {
		preferFormat = "svg"
	}
	if ref == "" || len(ref) > 180 || strings.HasPrefix(ref, "/") || strings.Contains(ref, "\\") || strings.Contains(ref, "..") || !selfhstRefRe.MatchString(ref) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Invalid icon reference."})
		return
	}
	imported, status, err := a.fetchSelfhstIconData(ref, preferFormat)
	if err != nil {
		writeJSON(w, status, map[string]any{"message": err.Error()})
		return
	}
	imported["ok"] = true
	imported["source"] = "selfhst"
	writeJSON(w, http.StatusOK, imported)
}

func (a *app) fetchSelfhstIconData(reference, preferFormat string) (map[string]any, int, error) {
	items, err := a.getSelfhstIconIndex()
	if err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("failed to import icon: %v", err)
	}
	var item *selfhstIcon
	for i := range items {
		if strings.EqualFold(items[i].Reference, reference) {
			item = &items[i]
			break
		}
	}
	if item == nil {
		return nil, http.StatusNotFound, fmt.Errorf("Icon not found.")
	}
	formats := []string{}
	if preferFormat == "png" {
		if item.HasPNG {
			formats = append(formats, "png")
		}
		if item.HasSVG {
			formats = append(formats, "svg")
		}
	} else {
		if item.HasSVG {
			formats = append(formats, "svg")
		}
		if item.HasPNG {
			formats = append(formats, "png")
		}
	}
	if len(formats) == 0 {
		return nil, http.StatusBadRequest, fmt.Errorf("Selected icon does not have a supported format.")
	}
	var lastErr error
	for _, ext := range formats {
		target := fmt.Sprintf("%s/%s/%s.%s", strings.TrimRight(a.cfg.SelfhstRawBase, "/"), ext, url.PathEscape(item.Reference), ext)
		resp, err := a.httpGet(target, 20*time.Second)
		if err != nil {
			lastErr = err
			continue
		}
		raw, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		if resp.StatusCode == http.StatusNotFound {
			lastErr = fmt.Errorf("404")
			continue
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, http.StatusBadGateway, fmt.Errorf("Icon source error (%d).", resp.StatusCode)
		}
		if len(raw) == 0 {
			continue
		}
		contentType := strings.ToLower(strings.TrimSpace(strings.SplitN(resp.Header.Get("Content-Type"), ";", 2)[0]))
		if contentType == "" {
			if ext == "svg" {
				contentType = "image/svg+xml"
			} else {
				contentType = "image/png"
			}
		}
		return map[string]any{
			"name":        item.Name,
			"reference":   item.Reference,
			"icon":        fmt.Sprintf("%s.%s", item.Reference, ext),
			"iconData":    "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(raw),
			"format":      ext,
			"contentType": contentType,
		}, http.StatusOK, nil
	}
	if lastErr != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("Failed to import icon: %v", lastErr)
	}
	return nil, http.StatusBadGateway, fmt.Errorf("Failed to import icon: unknown error")
}

func (a *app) handleImportIconify(w http.ResponseWriter, r *http.Request, payload map[string]any) {
	if _, ok := a.requireAuth(w, r, true); !ok {
		return
	}
	iconName := strings.TrimSpace(asString(payload["name"]))
	sourceHint := strings.ToLower(strings.TrimSpace(asString(payload["source"])))
	preferFormat := strings.ToLower(strings.TrimSpace(asString(payload["format"])))
	if preferFormat != "png" {
		preferFormat = "svg"
	}
	imported, status, err := a.fetchIconifyIconData(iconName, preferFormat, sourceHint)
	if err != nil {
		writeJSON(w, status, map[string]any{"message": err.Error()})
		return
	}
	imported["ok"] = true
	if _, ok := imported["source"]; !ok {
		imported["source"] = "iconify-simple"
	}
	writeJSON(w, http.StatusOK, imported)
}

func normalizeIconifyName(iconName, sourceHint string) (value, prefix, name string, sourceID string, err error) {
	value = strings.ToLower(strings.TrimSpace(iconName))
	value = strings.Join(strings.Fields(value), "")
	value = regexp.MustCompile(`:+`).ReplaceAllString(value, ":")
	sourceHint = strings.ToLower(strings.TrimSpace(sourceHint))
	sourcePrefixes := map[string]string{
		"iconify-simple": "simple-icons",
		"iconify-logos":  "logos",
	}
	prefixSources := map[string]string{
		"simple-icons": "iconify-simple",
		"logos":        "iconify-logos",
	}
	if !strings.Contains(value, ":") {
		if p, ok := sourcePrefixes[sourceHint]; ok {
			value = p + ":" + value
		}
	}
	if !iconifyNameRe.MatchString(value) {
		err = fmt.Errorf("Invalid icon name.")
		return
	}
	parts := strings.SplitN(value, ":", 2)
	prefix, name = parts[0], parts[1]
	sourceID, ok := prefixSources[prefix]
	if !ok {
		err = fmt.Errorf("Unsupported Iconify icon set.")
		return
	}
	return
}

func (a *app) fetchIconifyIconData(iconName, preferFormat, sourceHint string) (map[string]any, int, error) {
	value, prefix, name, sourceID, err := normalizeIconifyName(iconName, sourceHint)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	fmtWanted := preferFormat
	if fmtWanted != "png" {
		fmtWanted = "svg"
	}
	formats := []string{fmtWanted}
	if fmtWanted == "png" {
		formats = append(formats, "svg")
	}
	var lastStatus int
	var lastErr error
	for _, ext := range formats {
		target := fmt.Sprintf("%s/%s/%s.%s", strings.TrimRight(a.cfg.IconifyAPIBase, "/"), url.PathEscape(prefix), url.PathEscape(name), ext)
		resp, err := a.httpGet(target, 20*time.Second)
		if err != nil {
			lastErr = err
			lastStatus = http.StatusBadGateway
			continue
		}
		raw, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			lastStatus = http.StatusBadGateway
			continue
		}
		if resp.StatusCode == http.StatusNotFound && ext == "png" {
			lastErr = fmt.Errorf("404")
			lastStatus = http.StatusBadGateway
			continue
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, http.StatusBadGateway, fmt.Errorf("Icon source error (%d).", resp.StatusCode)
		}
		if len(raw) == 0 {
			lastErr = fmt.Errorf("empty icon data")
			lastStatus = http.StatusBadGateway
			continue
		}
		contentType := strings.ToLower(strings.TrimSpace(strings.SplitN(resp.Header.Get("Content-Type"), ";", 2)[0]))
		if contentType == "" {
			if ext == "svg" {
				contentType = "image/svg+xml"
			} else {
				contentType = "image/png"
			}
		}
		label := strings.Title(strings.ReplaceAll(name, "-", " "))
		return map[string]any{
			"name":        label,
			"reference":   value,
			"source":      sourceID,
			"icon":        fmt.Sprintf("%s.%s", name, ext),
			"iconData":    "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(raw),
			"format":      ext,
			"contentType": contentType,
		}, http.StatusOK, nil
	}
	if lastErr != nil {
		return nil, lastStatus, fmt.Errorf("Failed to import icon: %v", lastErr)
	}
	return nil, http.StatusBadGateway, fmt.Errorf("Failed to import icon.")
}
