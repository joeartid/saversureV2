package upload

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type ProxyHandler struct {
	client   *minio.Client
	endpoint string
	useSSL   bool
}

func NewProxyHandler(endpoint, accessKey, secretKey string, useSSL bool) (*ProxyHandler, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio proxy client: %w", err)
	}
	return &ProxyHandler{client: client, endpoint: endpoint, useSSL: useSSL}, nil
}

// ServeFile — GET /media/:bucket/*objectPath
// proxy ไฟล์จาก MinIO กลับมาให้ browser โดยตรง
func (h *ProxyHandler) ServeFile(c *gin.Context) {
	bucket := c.Param("bucket")
	objectPath := c.Param("objectPath")

	// trim leading slash
	objectPath = strings.TrimPrefix(objectPath, "/")

	if bucket == "" || objectPath == "" {
		c.Status(http.StatusNotFound)
		return
	}

	obj, err := h.client.GetObject(c.Request.Context(), bucket, objectPath, minio.GetObjectOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer obj.Close()

	info, err := obj.Stat()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	contentType := info.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("Content-Length", fmt.Sprintf("%d", info.Size))

	io.Copy(c.Writer, obj)
}
