# TOPIK Git Uploader

Double-click `TopikGitUploader.exe` to run TypeScript/TOPIK checks, stage source code, block secrets, create a timestamped commit, and push the current branch to `origin`.

Command-line usage:

```powershell
.\tools\git-uploader\TopikGitUploader.exe --yes --message "feat: update TOPIK Master"
```

The uploader respects `.gitignore`, blocks local `.env` files and known API key assignments, and rejects individual files over 50 MB.
