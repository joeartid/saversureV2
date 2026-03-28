package popup

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/apperror"
)

type Handler struct {
	svc *Service
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{svc: NewService(db)}
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	if items == nil {
		items = []Popup{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	p, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		apperror.RespondNotFound(c, "not_found")
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input CreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	input.TenantID = tenantID
	p, err := h.svc.Create(c.Request.Context(), input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var input UpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	p, err := h.svc.Update(c.Request.Context(), tenantID, id, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ListActive(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		// Graceful fallback: popups are cosmetic — return empty instead of 400
		c.JSON(http.StatusOK, gin.H{"data": []Popup{}})
		return
	}
	page := c.DefaultQuery("page", "")
	items, err := h.svc.ListActive(c.Request.Context(), tenantID, page)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	if items == nil {
		items = []Popup{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}
