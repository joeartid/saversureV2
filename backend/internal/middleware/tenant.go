package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// TenantIsolation extracts tenant_id from the JWT claims (set by auth middleware)
// and makes it available to downstream handlers. All DB queries should filter by this.
// super_admin can override the active tenant via X-Tenant-ID header.
func TenantIsolation() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetString("tenant_id")
		role := c.GetString("role")

		// super_admin can override tenant context to view/manage any brand
		if role == "super_admin" {
			if override := c.GetHeader("X-Tenant-ID"); override != "" {
				tenantID = override
			}
		}

		if tenantID == "" {
			tenantID = c.GetHeader("X-Tenant-ID")
		}

		if tenantID == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":   "missing_tenant",
				"message": "Tenant context is required",
			})
			return
		}

		c.Set("tenant_id", tenantID)
		c.Next()
	}
}
