package branding

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc *Service
	db  *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{svc: NewService(db), db: db}
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	settings, err := h.svc.Get(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var settings BrandingSettings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.Update(c.Request.Context(), tenantID, settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func (h *Handler) GetPublic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	settings, err := h.svc.Get(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func (h *Handler) GetBySlug(c *gin.Context) {
	slug := c.Query("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug query parameter is required"})
		return
	}

	var tenantID string
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT id FROM tenants WHERE slug = $1 AND status = 'active'`, slug,
	).Scan(&tenantID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant_not_found"})
		return
	}

	settings, err := h.svc.Get(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	settings.TenantID = tenantID
	c.JSON(http.StatusOK, settings)
}
