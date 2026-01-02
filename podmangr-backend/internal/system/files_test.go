package system

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListDirectory(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create some test files
	testFile := filepath.Join(tmpDir, "testfile.txt")
	if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	testDir := filepath.Join(tmpDir, "testdir")
	if err := os.Mkdir(testDir, 0755); err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}

	// Test listing
	listing, err := ListDirectory(tmpDir)
	if err != nil {
		t.Fatalf("ListDirectory returned error: %v", err)
	}

	if listing.Path != tmpDir {
		t.Errorf("Expected path %s, got %s", tmpDir, listing.Path)
	}

	if listing.Total != 2 {
		t.Errorf("Expected 2 items, got %d", listing.Total)
	}

	// Verify files are returned
	foundFile := false
	foundDir := false
	for _, f := range listing.Files {
		if f.Name == "testfile.txt" {
			foundFile = true
			if f.IsDir {
				t.Error("testfile.txt should not be a directory")
			}
		}
		if f.Name == "testdir" {
			foundDir = true
			if !f.IsDir {
				t.Error("testdir should be a directory")
			}
		}
	}

	if !foundFile {
		t.Error("testfile.txt not found in listing")
	}
	if !foundDir {
		t.Error("testdir not found in listing")
	}
}

func TestListDirectoryNotFound(t *testing.T) {
	_, err := ListDirectory("/nonexistent/path/that/should/not/exist")
	if err == nil {
		t.Error("ListDirectory should return error for non-existent path")
	}
}

func TestListDirectoryNotADirectory(t *testing.T) {
	// Create a temp file
	tmpFile, err := os.CreateTemp("", "podmangr-test-*.txt")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	_, err = ListDirectory(tmpFile.Name())
	if err == nil {
		t.Error("ListDirectory should return error for file path")
	}
}

func TestGetFileInfo(t *testing.T) {
	// Create a temp file
	tmpFile, err := os.CreateTemp("", "podmangr-test-*.txt")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test content")
	tmpFile.Close()

	info, err := GetFileInfo(tmpFile.Name())
	if err != nil {
		t.Fatalf("GetFileInfo returned error: %v", err)
	}

	if info.Path != tmpFile.Name() {
		t.Errorf("Expected path %s, got %s", tmpFile.Name(), info.Path)
	}

	if info.IsDir {
		t.Error("File should not be marked as directory")
	}

	if info.Size == 0 {
		t.Error("File size should be > 0")
	}

	if info.Extension != "txt" {
		t.Errorf("Expected extension txt, got %s", info.Extension)
	}
}

func TestCreateDirectory(t *testing.T) {
	// Create a temp directory
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Test creating a new directory
	newDir := filepath.Join(tmpDir, "newdir")
	err = CreateDirectory(newDir, 0755)
	if err != nil {
		t.Fatalf("CreateDirectory returned error: %v", err)
	}

	// Verify it exists
	if _, err := os.Stat(newDir); os.IsNotExist(err) {
		t.Error("Directory was not created")
	}
}

func TestCreateFile(t *testing.T) {
	// Create a temp directory
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Test creating a new file
	newFile := filepath.Join(tmpDir, "newfile.txt")
	err = CreateFile(newFile)
	if err != nil {
		t.Fatalf("CreateFile returned error: %v", err)
	}

	// Verify it exists
	if _, err := os.Stat(newFile); os.IsNotExist(err) {
		t.Error("File was not created")
	}
}

func TestDeletePath(t *testing.T) {
	// Create a temp directory with a file
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	testFile := filepath.Join(tmpDir, "testfile.txt")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Test deleting a file
	err = DeletePath(testFile, false)
	if err != nil {
		t.Fatalf("DeletePath returned error: %v", err)
	}

	// Verify it's deleted
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Error("File should be deleted")
	}
}

func TestDeletePathRecursive(t *testing.T) {
	// Create a temp directory with nested content
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	testSubDir := filepath.Join(tmpDir, "subdir")
	if err := os.Mkdir(testSubDir, 0755); err != nil {
		t.Fatalf("Failed to create test subdir: %v", err)
	}

	testFile := filepath.Join(testSubDir, "testfile.txt")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Test recursive deletion
	err = DeletePath(testSubDir, true)
	if err != nil {
		t.Fatalf("DeletePath returned error: %v", err)
	}

	// Verify it's deleted
	if _, err := os.Stat(testSubDir); !os.IsNotExist(err) {
		t.Error("Directory should be deleted")
	}
}

func TestDeleteDangerousPaths(t *testing.T) {
	// Test that dangerous paths cannot be deleted
	dangerousPaths := []string{
		"/",
		"/bin",
		"/boot",
		"/dev",
		"/etc",
		"/lib",
		"/lib64",
		"/proc",
		"/sbin",
		"/sys",
		"/usr",
		"/var",
	}

	for _, path := range dangerousPaths {
		err := DeletePath(path, true)
		if err == nil {
			t.Errorf("DeletePath should reject dangerous path: %s", path)
		}
	}
}

func TestRenamePath(t *testing.T) {
	// Create a temp directory
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a file to rename
	oldPath := filepath.Join(tmpDir, "oldname.txt")
	newPath := filepath.Join(tmpDir, "newname.txt")

	if err := os.WriteFile(oldPath, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Test renaming
	err = RenamePath(oldPath, newPath)
	if err != nil {
		t.Fatalf("RenamePath returned error: %v", err)
	}

	// Verify old path is gone
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error("Old path should not exist")
	}

	// Verify new path exists
	if _, err := os.Stat(newPath); os.IsNotExist(err) {
		t.Error("New path should exist")
	}
}

func TestCopyFile(t *testing.T) {
	// Create a temp directory
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create source file
	srcPath := filepath.Join(tmpDir, "source.txt")
	dstPath := filepath.Join(tmpDir, "dest.txt")
	content := []byte("test content for copy")

	if err := os.WriteFile(srcPath, content, 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	// Test copying
	err = CopyFile(srcPath, dstPath)
	if err != nil {
		t.Fatalf("CopyFile returned error: %v", err)
	}

	// Verify destination exists and has same content
	dstContent, err := os.ReadFile(dstPath)
	if err != nil {
		t.Fatalf("Failed to read destination file: %v", err)
	}

	if string(dstContent) != string(content) {
		t.Error("Copied file content does not match")
	}
}

func TestReadFileContent(t *testing.T) {
	// Create a temp file with content
	tmpFile, err := os.CreateTemp("", "podmangr-test-*.txt")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	content := "This is test content"
	tmpFile.WriteString(content)
	tmpFile.Close()

	// Test reading
	data, err := ReadFileContent(tmpFile.Name(), 1024)
	if err != nil {
		t.Fatalf("ReadFileContent returned error: %v", err)
	}

	if string(data) != content {
		t.Errorf("Expected content '%s', got '%s'", content, string(data))
	}
}

func TestReadFileContentTooLarge(t *testing.T) {
	// Create a temp file with content
	tmpFile, err := os.CreateTemp("", "podmangr-test-*.txt")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	// Write more than maxSize
	content := make([]byte, 100)
	tmpFile.Write(content)
	tmpFile.Close()

	// Test reading with small max size
	_, err = ReadFileContent(tmpFile.Name(), 10)
	if err == nil {
		t.Error("ReadFileContent should return error for file exceeding maxSize")
	}
}

func TestWriteFileContent(t *testing.T) {
	// Create a temp directory
	tmpDir, err := os.MkdirTemp("", "podmangr-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Test writing
	filePath := filepath.Join(tmpDir, "newfile.txt")
	content := []byte("new content")

	err = WriteFileContent(filePath, content, 0644)
	if err != nil {
		t.Fatalf("WriteFileContent returned error: %v", err)
	}

	// Verify content
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("Failed to read file: %v", err)
	}

	if string(data) != string(content) {
		t.Error("Written content does not match")
	}
}

func TestGetMimeType(t *testing.T) {
	tests := []struct {
		ext      string
		isDir    bool
		expected string
	}{
		{"txt", false, "text/plain"},
		{"json", false, "application/json"},
		{"html", false, "text/html"},
		{"png", false, "image/png"},
		{"jpg", false, "image/jpeg"},
		{"pdf", false, "application/pdf"},
		{"", true, "inode/directory"},
		{"unknown", false, "application/octet-stream"},
	}

	for _, tc := range tests {
		result := getMimeType(tc.ext, tc.isDir)
		if result != tc.expected {
			t.Errorf("getMimeType(%s, %v): expected %s, got %s", tc.ext, tc.isDir, tc.expected, result)
		}
	}
}
