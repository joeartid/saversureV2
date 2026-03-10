package customer

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MergeHandler struct {
	svc *MergeService
}

func NewMergeHandler(db *pgxpool.Pool) *MergeHandler {
	return &MergeHandler{svc: NewMergeService(db)}
}

func (h *MergeHandler) SearchUsers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	results, err := h.svc.SearchUsers(c.Request.Context(), tenantID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if results == nil {
		results = []UserSearchResult{}
	}
	c.JSON(http.StatusOK, gin.H{"data": results})
}

func (h *MergeHandler) TransferLINE(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	targetID := c.Param("id")

	var input TransferLINEInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.TransferLINE(c.Request.Context(), tenantID, targetID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MergeHandler) Merge(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var input MergeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.Merge(c.Request.Context(), tenantID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
