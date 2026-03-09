package linebot

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type SendMessageInput struct {
	UserID  string `json:"user_id" binding:"required"`
	Message string `json:"message" binding:"required"`
}

// SendMessage sends a LINE message to a specific user (admin action)
func (h *Handler) SendMessage(c *gin.Context) {
	var input SendMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tenantID := c.GetString("tenant_id")

	lineUID, err := h.svc.GetUserLineID(c.Request.Context(), tenantID, input.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "line_not_linked", "message": "ผู้ใช้ไม่ได้เชื่อมต่อ LINE"})
		return
	}

	if err := h.svc.PushText(c.Request.Context(), tenantID, lineUID, input.Message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "send_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

type BroadcastInput struct {
	Message string `json:"message" binding:"required"`
}

// Broadcast sends a LINE message to all LINE-connected users in the tenant
func (h *Handler) Broadcast(c *gin.Context) {
	var input BroadcastInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tenantID := c.GetString("tenant_id")

	rows, err := h.svc.db.Query(c.Request.Context(),
		`SELECT line_user_id FROM users
		 WHERE tenant_id = $1 AND line_user_id IS NOT NULL AND line_user_id != ''`,
		tenantID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query_failed"})
		return
	}
	defer rows.Close()

	var lineIDs []string
	for rows.Next() {
		var lid string
		if rows.Scan(&lid) == nil && lid != "" {
			lineIDs = append(lineIDs, lid)
		}
	}

	if len(lineIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "no_recipients", "count": 0})
		return
	}

	// LINE multicast supports up to 500 recipients per request
	batchSize := 500
	sent := 0
	for i := 0; i < len(lineIDs); i += batchSize {
		end := i + batchSize
		if end > len(lineIDs) {
			end = len(lineIDs)
		}
		batch := lineIDs[i:end]
		if err := h.svc.PushMulticast(c.Request.Context(), tenantID, batch, input.Message); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "partial_send",
				"message": err.Error(),
				"sent":    sent,
				"total":   len(lineIDs),
			})
			return
		}
		sent += len(batch)
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent", "count": sent})
}

type RichMenuInput struct {
	Name     string `json:"name" binding:"required"`
	Template string `json:"template" binding:"required"`
}

// CreateRichMenu creates a rich menu for the tenant's LINE OA
func (h *Handler) CreateRichMenu(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not_implemented", "message": "Rich menu management will be available in a future update"})
}

// ListRichMenus lists rich menus for the tenant
func (h *Handler) ListRichMenus(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not_implemented", "message": "Rich menu management will be available in a future update"})
}
