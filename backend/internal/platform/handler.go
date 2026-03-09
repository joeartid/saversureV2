package platform

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	identitySvc *IdentityService
	ledgerSvc   *LedgerService
	exchangeSvc *ExchangeService
}

func NewHandler(identitySvc *IdentityService, ledgerSvc *LedgerService, exchangeSvc *ExchangeService) *Handler {
	return &Handler{
		identitySvc: identitySvc,
		ledgerSvc:   ledgerSvc,
		exchangeSvc: exchangeSvc,
	}
}

func (h *Handler) LinkIdentity(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if tenantID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_context"})
		return
	}

	var req struct {
		IdentityType string `json:"identity_type" binding:"required"`
		IdentityKey  string `json:"identity_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_input", "message": err.Error()})
		return
	}

	link, err := h.identitySvc.LinkUser(c.Request.Context(), tenantID, userID, req.IdentityType, req.IdentityKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "link_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, link)
}

func (h *Handler) GetPlatformUser(c *gin.Context) {
	platformUserID := c.Param("id")
	if platformUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_id"})
		return
	}

	pu, err := h.identitySvc.GetPlatformUser(c.Request.Context(), platformUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pu)
}

func (h *Handler) GetMyPlatformIdentity(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if tenantID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_context"})
		return
	}

	var identityType, identityKey string
	// Try to find from user's LINE or phone
	_ = h.identitySvc.db.QueryRow(c.Request.Context(),
		`SELECT COALESCE(line_user_id, ''), COALESCE(phone, '') FROM users WHERE id = $1 AND tenant_id = $2`,
		userID, tenantID,
	).Scan(&identityType, &identityKey)

	idType := "line"
	idKey := identityType
	if idKey == "" {
		idType = "phone"
		idKey = identityKey
	}
	if idKey == "" {
		c.JSON(http.StatusOK, gin.H{"linked": false, "message": "No LINE or phone identity"})
		return
	}

	platformUserID, err := h.identitySvc.FindPlatformUserByIdentity(c.Request.Context(), idType, idKey)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"linked": false})
		return
	}

	pu, err := h.identitySvc.GetPlatformUser(c.Request.Context(), platformUserID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"linked": true, "platform_user_id": platformUserID})
		return
	}

	c.JSON(http.StatusOK, gin.H{"linked": true, "platform_user": pu})
}

func (h *Handler) Exchange(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if tenantID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_context"})
		return
	}

	var req struct {
		Amount int64 `json:"amount" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_input", "message": err.Error()})
		return
	}

	result, err := h.exchangeSvc.Exchange(c.Request.Context(), ExchangeRequest{
		TenantID: tenantID,
		UserID:   userID,
		Amount:   req.Amount,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exchange_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetPlatformBalance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if tenantID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_context"})
		return
	}

	var idType, idKey string
	_ = h.identitySvc.db.QueryRow(c.Request.Context(),
		`SELECT COALESCE(line_user_id, ''), COALESCE(phone, '') FROM users WHERE id = $1 AND tenant_id = $2`,
		userID, tenantID,
	).Scan(&idType, &idKey)

	iType := "line"
	iKey := idType
	if iKey == "" {
		iType = "phone"
		iKey = idKey
	}
	if iKey == "" {
		c.JSON(http.StatusOK, gin.H{"current": 0, "currency": "saversure_point"})
		return
	}

	platformUserID, err := h.identitySvc.FindPlatformUserByIdentity(c.Request.Context(), iType, iKey)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"current": 0, "currency": "saversure_point"})
		return
	}

	currency := c.DefaultQuery("currency", "saversure_point")
	bal, err := h.ledgerSvc.GetBalance(c.Request.Context(), platformUserID, currency)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"current": 0, "currency": currency})
		return
	}

	c.JSON(http.StatusOK, bal)
}

func (h *Handler) GetPlatformHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if tenantID == "" || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_context"})
		return
	}

	var idType, idKey string
	_ = h.identitySvc.db.QueryRow(c.Request.Context(),
		`SELECT COALESCE(line_user_id, ''), COALESCE(phone, '') FROM users WHERE id = $1 AND tenant_id = $2`,
		userID, tenantID,
	).Scan(&idType, &idKey)

	iType := "line"
	iKey := idType
	if iKey == "" {
		iType = "phone"
		iKey = idKey
	}
	if iKey == "" {
		c.JSON(http.StatusOK, gin.H{"data": []any{}})
		return
	}

	platformUserID, err := h.identitySvc.FindPlatformUserByIdentity(c.Request.Context(), iType, iKey)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []any{}})
		return
	}

	currency := c.DefaultQuery("currency", "saversure_point")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	entries, err := h.ledgerSvc.GetHistory(c.Request.Context(), platformUserID, currency, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "history_failed"})
		return
	}
	if entries == nil {
		entries = []PlatformLedgerEntry{}
	}

	c.JSON(http.StatusOK, gin.H{"data": entries})
}
