package donation

import (
	"net/http"
	"strconv"

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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.svc.List(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *Handler) ListActive(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	items, err := h.svc.ListActive(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input CreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	input.TenantID = tenantID

	d, err := h.svc.Create(c.Request.Context(), input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input UpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}

	d, err := h.svc.Update(c.Request.Context(), tenantID, id, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) Donate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	donationID := c.Param("id")

	var body struct {
		Points int `json:"points" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}

	hist, err := h.svc.Donate(c.Request.Context(), tenantID, donationID, userID, body.Points)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, hist)
}

func (h *Handler) GetHistory(c *gin.Context) {
	donationID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, err := h.svc.GetHistory(c.Request.Context(), donationID, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetMyDonations(c *gin.Context) {
	userID := c.GetString("user_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, err := h.svc.GetMyDonations(c.Request.Context(), userID, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}
