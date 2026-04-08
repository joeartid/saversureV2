package navmenu

import (
	"net/http"

	"saversure/internal/apperror"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc     *Service
	history *HistoryService
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{svc: NewService(db), history: NewHistoryService(db)}
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	menus, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	if menus == nil {
		menus = []NavMenu{}
	}
	c.JSON(http.StatusOK, gin.H{"data": menus})
}

func (h *Handler) GetByType(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	menuType := c.Param("type")
	m, err := h.svc.GetByType(c.Request.Context(), tenantID, menuType)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"items": []MenuItem{}, "version": 0})
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *Handler) Upsert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input UpsertInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.Respond(c, err)
		return
	}
	input.TenantID = tenantID
	input.UserID = userID

	existing, _ := h.svc.GetByType(c.Request.Context(), tenantID, input.MenuType)

	m, err := h.svc.Upsert(c.Request.Context(), input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}

	if existing != nil {
		_ = h.history.SaveSnapshot(c.Request.Context(), existing)
	}

	c.JSON(http.StatusOK, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	menuType := c.Param("type")
	if err := h.svc.Delete(c.Request.Context(), tenantID, menuType); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetPublic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	menuType := c.Param("type")
	m, err := h.svc.GetByType(c.Request.Context(), tenantID, menuType)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"items": []MenuItem{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": m.Items, "version": m.Version})
}

func (h *Handler) ListVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	menuType := c.Param("type")

	versions, err := h.history.ListVersions(c.Request.Context(), tenantID, menuType)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	if versions == nil {
		versions = []VersionEntry{}
	}
	c.JSON(http.StatusOK, gin.H{"data": versions})
}

func (h *Handler) RestoreVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	menuType := c.Param("type")

	var body struct {
		Version int `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}

	v, err := h.history.GetVersion(c.Request.Context(), tenantID, menuType, body.Version)
	if err != nil {
		apperror.RespondNotFound(c, "not_found")
		return
	}

	existing, _ := h.svc.GetByType(c.Request.Context(), tenantID, menuType)
	if existing != nil {
		_ = h.history.SaveSnapshot(c.Request.Context(), existing)
	}

	m, err := h.svc.Upsert(c.Request.Context(), UpsertInput{
		TenantID: tenantID,
		UserID:   userID,
		MenuType: menuType,
		Items:    v.Items,
	})
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, m)
}
