using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

internal static class TopikGitUploader
{
    private static string Run(string fileName, string arguments, string workingDirectory, bool echo)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        using (var process = Process.Start(startInfo))
        {
            if (process == null) throw new InvalidOperationException("Không thể chạy " + fileName + ".");
            var stdout = process.StandardOutput.ReadToEnd();
            var stderr = process.StandardError.ReadToEnd();
            process.WaitForExit();
            var output = (stdout + Environment.NewLine + stderr).Trim();
            if (echo && output.Length > 0) Console.WriteLine(output);
            if (process.ExitCode != 0)
                throw new InvalidOperationException(fileName + " " + arguments + " thất bại (mã " + process.ExitCode + ").\n" + output);
            return output;
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, ".git"))) return directory.FullName;
            directory = directory.Parent;
        }
        return Run("git", "rev-parse --show-toplevel", Environment.CurrentDirectory, false).Trim();
    }

    private static void EnsureSafeStaging(string root)
    {
        var staged = Run("git", "diff --cached --name-only", root, false)
            .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        var forbidden = staged.Where(path =>
            (Path.GetFileName(path).StartsWith(".env", StringComparison.OrdinalIgnoreCase) &&
             !path.Equals(".env.example", StringComparison.OrdinalIgnoreCase)) ||
            Regex.IsMatch(path, @"(^|/)(secrets?|credentials?)(\.|/|$)", RegexOptions.IgnoreCase)
        ).ToArray();
        if (forbidden.Length > 0)
            throw new InvalidOperationException("Đã chặn file nhạy cảm:\n" + string.Join("\n", forbidden));

        foreach (var path in staged)
        {
            var fullPath = Path.Combine(root, path.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(fullPath) && new FileInfo(fullPath).Length > 50L * 1024L * 1024L)
                throw new InvalidOperationException("File vượt 50 MB, GitHub có thể từ chối: " + path);
        }

        var diff = Run("git", "diff --cached --no-color -U0", root, false);
        var secretPattern = new Regex(@"(?im)^\+\s*(?:export\s+)?(GEMINI_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*['""]?(?!\*{3})[A-Za-z0-9_\-]{12,}|AIza[0-9A-Za-z_\-]{30,}|sk-[0-9A-Za-z_\-]{20,}");
        if (secretPattern.IsMatch(diff))
            throw new InvalidOperationException("Phát hiện giá trị API key trong phần chuẩn bị commit. Đã dừng upload.");
    }

    public static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        try
        {
            var root = FindRepositoryRoot();
            var yes = args.Any(arg => arg.Equals("--yes", StringComparison.OrdinalIgnoreCase));
            var skipChecks = args.Any(arg => arg.Equals("--skip-checks", StringComparison.OrdinalIgnoreCase));
            var message = "chore: backup TOPIK Master " + DateTime.Now.ToString("yyyy-MM-dd HH:mm");
            for (var index = 0; index < args.Length - 1; index++)
                if (args[index].Equals("--message", StringComparison.OrdinalIgnoreCase)) message = args[index + 1];

            Console.WriteLine("TOPIK Git Uploader");
            Console.WriteLine("Repository: " + root);
            Console.WriteLine("Nhánh: " + Run("git", "branch --show-current", root, false).Trim());
            Console.WriteLine();
            Console.WriteLine(Run("git", "status --short", root, false));

            if (!yes)
            {
                Console.Write("\nKiểm tra, commit và push toàn bộ mã nguồn? [Y/N]: ");
                var answer = Console.ReadLine();
                if (!string.Equals(answer, "Y", StringComparison.OrdinalIgnoreCase)) return 0;
            }

            if (!skipChecks)
            {
                Console.WriteLine("\n[1/5] Kiểm tra TypeScript và TOPIK...");
                Run("cmd.exe", "/d /s /c \"npx tsc --noEmit && npm run topik:verify\"", root, true);
            }
            else Console.WriteLine("\n[1/5] Bỏ qua kiểm tra theo yêu cầu.");

            Console.WriteLine("\n[2/5] Chuẩn bị file...");
            Run("git", "add -A", root, false);
            EnsureSafeStaging(root);

            var stagedNames = Run("git", "diff --cached --name-only", root, false);
            if (string.IsNullOrWhiteSpace(stagedNames))
                Console.WriteLine("Không có thay đổi mới để commit.");
            else
            {
                Console.WriteLine(stagedNames);
                Console.WriteLine("\n[3/5] Tạo commit...");
                Run("git", "commit -m " + Quote(message), root, true);
            }

            var branch = Run("git", "branch --show-current", root, false).Trim();
            if (string.IsNullOrWhiteSpace(branch)) throw new InvalidOperationException("Repository đang ở detached HEAD.");
            Console.WriteLine("\n[4/5] Push origin/" + branch + "...");
            Run("git", "push -u origin " + Quote(branch), root, true);
            Console.WriteLine("\n[5/5] Hoàn tất. Mã nguồn đã được upload an toàn.");
            if (!yes) { Console.WriteLine("Nhấn Enter để đóng..."); Console.ReadLine(); }
            return 0;
        }
        catch (Exception error)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("\nUPLOAD THẤT BẠI: " + error.Message);
            Console.ResetColor();
            if (!args.Any(arg => arg.Equals("--yes", StringComparison.OrdinalIgnoreCase)))
            {
                Console.WriteLine("Nhấn Enter để đóng...");
                Console.ReadLine();
            }
            return 1;
        }
    }
}
