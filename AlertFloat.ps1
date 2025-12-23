<#
.SYNOPSIS
    Alert Indicator v21 - Jarvis Edition (Full Restoration)
#>

param(
    [string]$City = "22",
    [string]$ApiUrl = "http://localhost:3002",
    [int]$Interval = 30
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore 
Add-Type -AssemblyName System.Speech        
Write-Host "--- Loading Alert Indicator & Jarvis AI ---"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$historyFile = Join-Path $scriptDir "history.json"
$configFile = Join-Path $scriptDir "alert_config.json"

# === DUPLICATE PREVENTION ===
$currentPid = $PID
Get-Process -Name "powershell", "pwsh" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Id -ne $currentPid) {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmd -match "AlertFloat") { [void](Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue) }
        }
        catch {}
    }
}

# Audio Setup
$script:player = New-Object System.Windows.Media.MediaPlayer

function Play-HappyMelody {
    try {
        [console]::Beep(523, 100) # C5
        [console]::Beep(659, 100) # E5
        [console]::Beep(784, 100) # G5
        [console]::Beep(1046, 250) # C6
    }
    catch {}
}

function Play-AlertSound($type) {
    if (-not $script:soundEnabled) { return }
    try {
        if ($type -eq "ALERT") {
            $soundPath = Join-Path $scriptDir "media\sounds\air-alert.mp3"
            if (Test-Path $soundPath) {
                $script:player.Open((New-Object System.Uri($soundPath)))
                $script:player.Play()
            }
            else { [void][System.Media.SystemSounds]::Exclamation.Play() }
        }
        else {
            # Alert End - Happy Sound + Official Voice MP3
            $script:player.Stop()
            
            # 1. Cheerful Arpeggio
            Play-HappyMelody
            
            # 2. Play the official "All Clear" voice MP3
            $clearPath = Join-Path $scriptDir "media\sounds\air-clear.mp3"
            if (Test-Path $clearPath) {
                $script:player.Open((New-Object System.Uri($clearPath)))
                $script:player.Play()
            }
        }
    }
    catch {
        [void][System.Media.SystemSounds]::Beep.Play()
    }
}

# Config
$defaultConfig = @{ City = $City; SoundEnabled = $true; FloatingVisible = $false }
if (Test-Path $configFile) { 
    try { $config = Get-Content $configFile -Raw | ConvertFrom-Json } 
    catch { $config = $defaultConfig } 
}
else { $config = $defaultConfig }

$script:selectedCity = if ($config.City) { $config.City } else { $City }
$script:soundEnabled = if ($null -ne $config.SoundEnabled) { $config.SoundEnabled } else { $true }
$script:floatingVisible = if ($null -ne $config.FloatingVisible) { $config.FloatingVisible } else { $false }

function Save-Config {
    @{ City = $script:selectedCity; SoundEnabled = $script:soundEnabled; FloatingVisible = $script:floatingVisible } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8
}

$script:history = @()
if (Test-Path $historyFile) { try { $script:history = @(Get-Content $historyFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch {} }

function Add-History($city, $type, $location) {
    $entry = @{ Time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"); City = $city; Type = $type; Location = $location }
    $script:history = @($entry) + $script:history | Select-Object -First 50
    $script:history | ConvertTo-Json | Set-Content $historyFile -Encoding UTF8
}

# Oblast UIDs from ukrainealarm.com API
$oblastData = [ordered]@{
    "3"  = @{ Name = "Khmelnytska"; Rayons = [ordered]@{ "134" = "Khmelnytskyi"; "135" = "Kamianets-Podilskyi"; "136" = "Shepetivskyi" } }
    "4"  = @{ Name = "Vinnytska"; Rayons = [ordered]@{ "32" = "Tulchynskyi"; "33" = "Mohyliv-Podilskyi"; "34" = "Khmilnytskyi"; "35" = "Zhmerynskyi"; "36" = "Vinnytskyi"; "37" = "Haisynskyi" } }
    "5"  = @{ Name = "Rivnenska"; Rayons = [ordered]@{ "110" = "Varaskyi"; "111" = "Dubenskyi"; "112" = "Rivnenskyi"; "113" = "Sarnenskyi" } }
    "8"  = @{ Name = "Volynska"; Rayons = [ordered]@{ "38" = "Volodymyr-Volynskyi"; "39" = "Lutskyi"; "40" = "Kovelskyi"; "41" = "Kamin-Kashyrskyi" } }
    "9"  = @{ Name = "Dnipropetrovska"; Rayons = [ordered]@{ "42" = "Kamianskyi"; "43" = "Novomoskovskyi"; "44" = "Dniprovskyi"; "45" = "Pavlohradskyi"; "46" = "Kryvorizkyi"; "47" = "Nikopolskyi"; "48" = "Synelnykivskyi" } }
    "10" = @{ Name = "Zhytomyrska"; Rayons = [ordered]@{ "57" = "Berdychivskyi"; "58" = "Korostenskyi"; "59" = "Zhytomyrskyi"; "60" = "Zviahelskyi" } }
    "11" = @{ Name = "Zakarpatska"; Rayons = [ordered]@{ "61" = "Berehivskyi"; "62" = "Khustskyi"; "63" = "Rakhivskyi"; "64" = "Tiachivskyi"; "65" = "Mukachivskyi"; "66" = "Uzhhorodskyi" } }
    "12" = @{ Name = "Zaporizka"; Rayons = [ordered]@{ "145" = "Polohivskyi"; "146" = "Vasylivskyi"; "147" = "Berdyanskyi"; "148" = "Melitopolskyi"; "149" = "Zaporizkyi" } }
    "13" = @{ Name = "Ivano-Frankivska"; Rayons = [ordered]@{ "67" = "Verkhovynskyi"; "68" = "Ivano-Frankivskyi"; "69" = "Kosivskyi"; "70" = "Kolomyiskyi"; "71" = "Kaluskyi"; "72" = "Nadvirnianskyi" } }
    "14" = @{ Name = "Kyivska"; Rayons = [ordered]@{ "73" = "Bilotserkivskyi"; "74" = "Vyshhorodskyi"; "75" = "Buchanskyi"; "76" = "Obukhivskyi"; "77" = "Fastivskyi"; "78" = "Boryspilskyi"; "79" = "Brovarskyi" } }
    "15" = @{ Name = "Kirovohradska"; Rayons = [ordered]@{ "80" = "Oleksandriiskyi"; "81" = "Kropyvnytskyi"; "82" = "Holovanivskyi"; "83" = "Novoukrainskyi" } }
    "16" = @{ Name = "Luhanska"; Rayons = [ordered]@{} }
    "17" = @{ Name = "Mykolaivska"; Rayons = [ordered]@{ "95" = "Voznesenskyi"; "96" = "Bashtanskyi"; "97" = "Pervomaiskyi"; "98" = "Mykolaivskyi" } }
    "18" = @{ Name = "Odeska"; Rayons = [ordered]@{ "99" = "Podilskyi"; "100" = "Berezivskyi"; "101" = "Izmailskyi"; "102" = "Bilhorod-Dnistrovskyi"; "103" = "Rozdilnianskyi"; "104" = "Odeskyi"; "105" = "Bolhradskyi" } }
    "19" = @{ Name = "Poltavska"; Rayons = [ordered]@{ "106" = "Lubenskyi"; "107" = "Kremenchutskyi"; "108" = "Myrhorodskyi"; "109" = "Poltavskyi" } }
    "20" = @{ Name = "Sumska"; Rayons = [ordered]@{ "114" = "Sumskyi"; "115" = "Shostkynskyi"; "116" = "Romenskyi"; "117" = "Konotopskyi"; "118" = "Okhtyrskyi" } }
    "21" = @{ Name = "Ternopilska"; Rayons = [ordered]@{ "119" = "Ternopilskyi"; "120" = "Kremenetskyi"; "121" = "Chortkivskyi" } }
    "22" = @{ Name = "Kharkivska"; Rayons = [ordered]@{ "122" = "Chuhuivskyi"; "123" = "Kupianskyi"; "124" = "Kharkivskyi"; "125" = "Iziumskyi"; "126" = "Bohodukhivskyi"; "127" = "Krasnohradskyi"; "128" = "Lozivskyi" } }
    "23" = @{ Name = "Khersonska"; Rayons = [ordered]@{ "129" = "Beryslaskyi"; "130" = "Skadovskyi"; "131" = "Kakhovskyi"; "132" = "Khersonskyi"; "133" = "Henicheskyi" } }
    "24" = @{ Name = "Cherkaska"; Rayons = [ordered]@{ "150" = "Zvenyhorodskyi"; "151" = "Umanskyi"; "152" = "Cherkaskyi"; "153" = "Zolotonoiskyi" } }
    "25" = @{ Name = "Chernihivska"; Rayons = [ordered]@{ "140" = "Chernihivskyi"; "141" = "Novhorod-Siverskyi"; "142" = "Nizhynskyi"; "143" = "Prylutskyi"; "144" = "Koriukivskyi" } }
    "26" = @{ Name = "Chernivetska"; Rayons = [ordered]@{ "137" = "Chernivetskyi"; "138" = "Vyzhnytskyi"; "139" = "Dnistrovskyi" } }
    "27" = @{ Name = "Lvivska"; Rayons = [ordered]@{ "88" = "Sambirskyi"; "89" = "Stryiskyi"; "90" = "Lvivskyi"; "91" = "Drohobytskyi"; "92" = "Chervonohradskyi"; "93" = "Yavorivskyi"; "94" = "Zolochivskyi" } }
    "28" = @{ Name = "Donetska"; Rayons = [ordered]@{ "49" = "Kalmiuskyi"; "50" = "Kramatorskyi"; "51" = "Horlivskyi"; "52" = "Mariupolskyi"; "53" = "Donetskyi"; "54" = "Bakhmutskyi"; "55" = "Volnovaskyi"; "56" = "Pokrovskyi" } }
    "31" = @{ Name = "Kyiv City"; Rayons = [ordered]@{ "31" = "Kyiv" } }
}

$colorSafe = [System.Drawing.Color]::FromArgb(46, 204, 113)
$colorAlert = [System.Drawing.Color]::FromArgb(231, 76, 60)
$colorError = [System.Drawing.Color]::FromArgb(243, 156, 18)

function New-CircleIcon($c) {
    $b = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $br = New-Object System.Drawing.SolidBrush($c)
    $g.FillEllipse($br, 1, 1, 14, 14)
    $br.Dispose(); $g.Dispose()
    return [System.Drawing.Icon]::FromHandle($b.GetHicon())
}

$iconGreen = New-CircleIcon $colorSafe
$iconRed = New-CircleIcon $colorAlert
$iconOrange = New-CircleIcon $colorError

$script:floats = @()
foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
    try {
        $f = New-Object System.Windows.Forms.Form
        $f.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
        $f.ControlBox = $false
        $f.ShowInTaskbar = $false
        $f.MinimumSize = New-Object System.Drawing.Size(0, 0)
        $f.Size = New-Object System.Drawing.Size($screen.Bounds.Width, 1)
        $rect = New-Object System.Drawing.Rectangle(0, 0, $screen.Bounds.Width, 1)
        $f.Region = New-Object System.Drawing.Region($rect)
        $f.StartPosition = 'Manual'
        $f.Left = $screen.Bounds.Left
        $f.Top = $screen.WorkingArea.Bottom - 1
        $f.TopMost = $true
        $f.BackColor = $colorSafe
        $f.Visible = $script:floatingVisible
        $f.Name = "AlertStrip"
        $script:floats += $f
    }
    catch {}
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $iconGreen
$tray.Text = "Alert Indicator"
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusItem.Text = "Status: Loading..."
$statusItem.Enabled = $false
[void]$menu.Items.Add($statusItem)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# Location menu
$locMenu = New-Object System.Windows.Forms.ToolStripMenuItem
$locMenu.Text = "Location"
$script:allMenuItems = @()
foreach ($oblId in $oblastData.Keys) {
    $obl = $oblastData[$oblId]
    $oblItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $oblItem.Text = $obl.Name
    $oblSelf = New-Object System.Windows.Forms.ToolStripMenuItem
    $oblSelf.Text = "All $($obl.Name)"
    $oblSelf.Tag = $oblId
    if ($oblId -eq $script:selectedCity) { $oblSelf.Checked = $true }
    $oblSelf.Add_Click({ param($s, $e)
            foreach ($m in $script:allMenuItems) { $m.Checked = $false }
            $s.Checked = $true
            $script:selectedCity = $s.Tag
            Save-Config; DoCheck
        })
    [void]$oblItem.DropDownItems.Add($oblSelf)
    $script:allMenuItems += $oblSelf
    [void]$oblItem.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    foreach ($rayonId in $obl.Rayons.Keys) {
        $rayonItem = New-Object System.Windows.Forms.ToolStripMenuItem
        $rayonItem.Text = $obl.Rayons[$rayonId]
        $rayonItem.Tag = $rayonId
        if ($rayonId -eq $script:selectedCity) { $rayonItem.Checked = $true }
        $rayonItem.Add_Click({ param($s, $e)
                foreach ($m in $script:allMenuItems) { $m.Checked = $false }
                $s.Checked = $true
                $script:selectedCity = $s.Tag
                Save-Config; DoCheck
            })
        [void]$oblItem.DropDownItems.Add($rayonItem)
        $script:allMenuItems += $rayonItem
    }
    [void]$locMenu.DropDownItems.Add($oblItem)
}
[void]$menu.Items.Add($locMenu)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$showItem = New-Object System.Windows.Forms.ToolStripMenuItem
$showItem.Text = if ($script:floatingVisible) { "Hide Strip" } else { "Show Strip" }
$showItem.Add_Click({
        $script:floatingVisible = -not $script:floatingVisible
        foreach ($f in $script:floats) { 
            $f.Visible = $script:floatingVisible
            if ($script:floatingVisible) {
                $f.TopMost = $true
                $f.BringToFront()
                $f.Refresh()
            }
        }
        $showItem.Text = if ($script:floatingVisible) { "Hide Strip" } else { "Show Strip" }
        Save-Config
    })
[void]$menu.Items.Add($showItem)

$sndItem = New-Object System.Windows.Forms.ToolStripMenuItem
$sndItem.Text = if ($script:soundEnabled) { "Sound: ON" } else { "Sound: OFF" }
$sndItem.Add_Click({
        $script:soundEnabled = -not $script:soundEnabled
        $sndItem.Text = if ($script:soundEnabled) { "Sound: ON" } else { "Sound: OFF" }
        Save-Config
    })
[void]$menu.Items.Add($sndItem)

$hisItem = New-Object System.Windows.Forms.ToolStripMenuItem
$hisItem.Text = "History"
$hisItem.Add_Click({
        try { [void](Start-Process "$ApiUrl/history.html") } catch {}
    })
[void]$menu.Items.Add($hisItem)

# === FULL TESTING MENU ===
$testMenu = New-Object System.Windows.Forms.ToolStripMenuItem
$testMenu.Text = "Testing & Bot"

$simAlert = New-Object System.Windows.Forms.ToolStripMenuItem
$simAlert.Text = "Simulate: ALERT (Local)"
$simAlert.Add_Click({
        $tray.Icon = $iconRed
        foreach ($f in $script:floats) { $f.BackColor = $colorAlert }
        Play-AlertSound "ALERT"
        $tray.ShowBalloonTip(3000, "Simulation", "Local Alert Active", [System.Windows.Forms.ToolTipIcon]::Error)
    })
[void]$testMenu.DropDownItems.Add($simAlert)

$simSafe = New-Object System.Windows.Forms.ToolStripMenuItem
$simSafe.Text = "Simulate: SAFE (Jarvis)"
$simSafe.Add_Click({
        $tray.Icon = $iconGreen
        foreach ($f in $script:floats) { $f.BackColor = $colorSafe }
        Play-AlertSound "SAFE"
        $tray.ShowBalloonTip(3000, "Simulation", "Local Alert Ended", [System.Windows.Forms.ToolTipIcon]::Info)
    })
[void]$testMenu.DropDownItems.Add($simSafe)

$simErr = New-Object System.Windows.Forms.ToolStripMenuItem
$simErr.Text = "Simulate: API Error"
$simErr.Add_Click({
        $tray.Icon = $iconOrange
        foreach ($f in $script:floats) { $f.BackColor = $colorError }
        $tray.ShowBalloonTip(3000, "Simulation", "API Connection Error", [System.Windows.Forms.ToolTipIcon]::Warning)
    })
[void]$testMenu.DropDownItems.Add($simErr)

[void]$testMenu.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$botAlert = New-Object System.Windows.Forms.ToolStripMenuItem
$botAlert.Text = "BOT: Send Test Alert"
$botAlert.ForeColor = [System.Drawing.Color]::Red
$botAlert.Add_Click({
        try {
            if (-not $script:selectedCity) { return }
            $p = @{ locationUid = $script:selectedCity; type = "alert" }
            $json = $p | ConvertTo-Json
            $res = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/test/send" -Body $json -ContentType "application/json"
            $msg = "Sent to $($res.sent) subscribers."
            $tray.ShowBalloonTip(3000, "Bot Interaction", $msg, [System.Windows.Forms.ToolTipIcon]::Info)
        }
        catch {
            $tray.ShowBalloonTip(3000, "Bot Error", $_.Exception.Message, [System.Windows.Forms.ToolTipIcon]::Error)
        }
    })
[void]$testMenu.DropDownItems.Add($botAlert)

$botEnd = New-Object System.Windows.Forms.ToolStripMenuItem
$botEnd.Text = "BOT: Send Test End"
$botEnd.ForeColor = [System.Drawing.Color]::Green
$botEnd.Add_Click({
        try {
            if (-not $script:selectedCity) { return }
            $p = @{ locationUid = $script:selectedCity; type = "end" }
            $json = $p | ConvertTo-Json
            $res = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/test/send" -Body $json -ContentType "application/json"
            $msg = "Sent to $($res.sent) subscribers."
            $tray.ShowBalloonTip(3000, "Bot Interaction", $msg, [System.Windows.Forms.ToolTipIcon]::Info)
        }
        catch {
            $tray.ShowBalloonTip(3000, "Bot Error", $_.Exception.Message, [System.Windows.Forms.ToolTipIcon]::Error)
        }
    })
[void]$testMenu.DropDownItems.Add($botEnd)

[void]$menu.Items.Add($testMenu)

$exItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exItem.Text = "Exit"
$exItem.Add_Click({
        $tray.Visible = $false; $tray.Dispose()
        [System.Windows.Forms.Application]::Exit()
    })
[void]$menu.Items.Add($exItem)

$tray.ContextMenuStrip = $menu
$script:isAlert = $false
$script:lastState = $null
$script:loc = ""

function DoCheck {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Encoding = [System.Text.Encoding]::UTF8
        $json = $wc.DownloadString("$ApiUrl/api/status/$($script:selectedCity)")
        $data = $json | ConvertFrom-Json
        $wc.Dispose()
        $script:loc = $data.location
        $newState = ($data.alert -eq $true)
        if ($null -ne $script:lastState -and $script:lastState -ne $newState) {
            if ($newState) {
                Add-History $script:selectedCity "ALERT" $script:loc
                Play-AlertSound "ALERT"
            }
            else {
                Add-History $script:selectedCity "END" $script:loc
                Play-AlertSound "SAFE"
            }
        }
        $script:isAlert = $newState
        $script:lastState = $newState
        if ($script:isAlert) {
            $tray.Icon = $iconRed; $statusItem.Text = "ALERT!"
            foreach ($f in $script:floats) { $f.BackColor = $colorAlert }
        }
        else {
            $tray.Icon = $iconGreen; $statusItem.Text = "Safe"
            foreach ($f in $script:floats) { $f.BackColor = $colorSafe }
        }

        # Keep strips healthy: refresh position and ensure TopMost
        $screenIdx = 0
        foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
            if ($screenIdx -lt $script:floats.Count) {
                $f = $script:floats[$screenIdx]
                if ($f -and -not $f.IsDisposed) {
                    $f.Left = $screen.Bounds.Left
                    $f.Top = $screen.WorkingArea.Bottom - 1
                    $f.Width = $screen.Bounds.Width
                    if ($script:floatingVisible) {
                        $f.TopMost = $true
                    }
                }
            }
            $screenIdx++
        }
    }
    catch { $statusItem.Text = "API Error" }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $Interval * 1000
$timer.Add_Tick({ DoCheck })
$timer.Start()

DoCheck
Write-Host "✅ Alert v21 - Jarvis Full Restoration."
$ctx = New-Object System.Windows.Forms.ApplicationContext
[System.Windows.Forms.Application]::Run($ctx)
