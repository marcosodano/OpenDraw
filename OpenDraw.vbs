Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = appDir

On Error Resume Next
Set procEnv = sh.Environment("Process")
procEnv.Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0

electronExe = fso.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
cmd = """" & electronExe & """ ."
If WScript.Arguments.Count > 0 Then
  Dim i
  For i = 0 To WScript.Arguments.Count - 1
    cmd = cmd & " """ & WScript.Arguments(i) & """"
  Next
End If

' Launch GUI-subsystem Electron directly without spawning cmd.exe
sh.Run cmd, 1, False
