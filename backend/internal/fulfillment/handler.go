package fulfillment

import (
	"net/http"
	"strconv"
	"time"

	"saversure/internal/apperror"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

var validFulfillmentStatuses = map[string]bool{
	"pending":   true,
	"preparing": true,
	"shipped":   true,
	"delivered": true,
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func isValidFulfillmentStatus(status string) bool {
	return validFulfillmentStatuses[status]
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
		apperror.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}

	if !isValidFulfillmentStatus(input.FulfillmentStatus) {
		apperror.RespondValidation(c, "status must be: pending, preparing, shipped, delivered")
		return
	}

	if err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, input); err != nil {
		apperror.RespondNotFound(c, "not_found")
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
		apperror.RespondValidation(c, err.Error())
		return
	}
	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "ids must not be empty"})
		return
	}
	if !isValidFulfillmentStatus(input.FulfillmentStatus) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "status must be: pending, preparing, shipped, delivered"})
		return
	}

	updated, err := h.svc.BulkUpdateStatus(c.Request.Context(), tenantID, input.IDs, UpdateStatusInput{
		FulfillmentStatus: input.FulfillmentStatus,
		TrackingNumber:    input.TrackingNumber,
	})
	if err != nil {
		apperror.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated", "count": updated})
}

type ExportPDFInput struct {
	IDs []string `json:"ids" binding:"required"`
}

func (h *Handler) ExportPDF(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var input ExportPDFInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	if len(input.IDs) == 0 {
		apperror.RespondValidation(c, "ids must not be empty")
		return
	}

	items, err := h.svc.ListByIDs(c.Request.Context(), tenantID, input.IDs)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	if len(items) == 0 {
		apperror.RespondNotFound(c, "not_found")
		return
	}
	if len(items) != len(input.IDs) {
		apperror.RespondValidation(c, "some selected items were not found or are not confirmed")
		return
	}

	pdfBytes, err := BuildDeliveryNotesPDF(items)
	if err != nil {
		apperror.Respond(c, apperror.Internal("pdf_error"))
		return
	}

	filename := "delivery-notes-" + time.Now().Format("20060102-150405") + ".pdf"
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}
