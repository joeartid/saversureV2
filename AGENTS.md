<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Backend Debug Scripts

อย่าวาง standalone Go script (`package main`) ไว้ใน `backend/` root โดยตรง
จะชน `package main` ของ `cmd/api/main.go` ทำให้ `go vet ./...` fail

ถ้าต้องการเขียน debug/CLI tool:
- ✅ วางใน `backend/cmd/<toolname>/main.go` (เช่น `cmd/checkuser/main.go`)
- ✅ หรือวางนอก git ที่ `backend/.local/` (gitignored)
- ❌ ห้ามวางที่ `backend/*.go` ใน root โดยตรง

ไฟล์ pattern เหล่านี้ถูก gitignore ไว้แล้ว:
- `backend/check_*.go`
- `backend/*_cmd.go`
- `backend/temp_*.go`
- `backend/debug_*.go`
