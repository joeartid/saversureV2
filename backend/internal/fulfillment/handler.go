package fulfillment

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")

	items, total, err := h.svc.List(c.Request.Context(), tenantID, ListFilter{
		Status: status,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	valid := map[string]bool{"pending": true, "preparing": true, "shipped": true, "delivered": true}
	if !valid[input.FulfillmentStatus] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "status must be: pending, preparing, shipped, delivered"})
		return
	}

	if err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, input); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

type BulkUpdateInput struct {
	IDs               []string `json:"ids" binding:"required"`
	FulfillmentStatus string   `json:"fulfillment_status" binding:"required"`
	TrackingNumber    *string  `json:"tracking_number"`
}

func (h *Handler) BulkUpdate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var input BulkUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	updated, err := h.svc.BulkUpdateStatus(c.Request.Context(), tenantID, input.IDs, UpdateStatusInput{
		FulfillmentStatus: input.FulfillmentStatus,
		TrackingNumber:    input.TrackingNumber,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated", "count": updated})
}
