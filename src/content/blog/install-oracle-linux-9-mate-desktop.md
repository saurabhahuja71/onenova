---
title: "Install Oracle Linux 9 with MATE Desktop: Community Build Walkthrough"
description: "A new-user walkthrough of the Oracle Linux 9 MATE community ISO: download and verify, boot USB or VM, pick MATE Desktop in Anaconda Software Selection, install, and verify — with screenshots from a real UEFI run."
pubDate: 2026-08-23
author: "Saurabh Ahuja"
tags:
  - oracle-linux
  - mate
  - anaconda
  - installer
  - linux
  - desktop
featured: false
draft: false
---

Oracle Linux ships GNOME as its desktop experience, but plenty of admins, homelab users, and developers prefer something lighter and more traditional. **MATE** — the continuation of the classic GNOME 2 layout (panel, window manager, Caja file manager, MATE Terminal) — was never offered as a selectable option in the Oracle Linux 9 installer. So I built one.

This post walks you through installing the **Oracle Linux 9 MATE Desktop Community Build v1.0.0** step by step, using screenshots captured from a real QEMU/KVM UEFI run of the production ISO. It is a **community build**, not an official Oracle distribution or an Oracle-supported ISO.

> **What you will achieve**
>
> - Download the ISO from the Internet Archive and verify its SHA256 checksum
> - Boot it from a USB stick or a VM (BIOS or UEFI)
> - Pick **MATE Desktop** directly under **Base Environment** in Anaconda's Software Selection — no post-install scripts, no extra repositories
> - Install, reboot into MATE, and verify the session
> - Understand (briefly) how MATE was integrated without modifying Anaconda

---

## 1. Download and verify the ISO

The production ISO is hosted on the Internet Archive:

- **Download:** [oracle-linux-9-mate-install-v1.0.0.iso](https://archive.org/download/oracle-linux-9-mate-install-v1.0.0/oracle-linux-9-mate-install-v1.0.0.iso)
- **Archive item:** <https://archive.org/details/oracle-linux-9-mate-install-v1.0.0>
- **Source code:** <https://github.com/saurabhahuja71/oracle-linux-9-mate-install> (tag `v1.0.0`)

<iframe src="https://archive.org/embed/oracle-linux-9-mate-install-v1.0.0" width="640" height="480" frameborder="0" webkitallowfullscreen="true" mozallowfullscreen="true" allowfullscreen></iframe>

The build uses Oracle Linux 9.8-era x86_64 installer components (Anaconda 34.25.7.14) and contains **1938 RPMs**.

Always verify before use:

```bash
sha256sum oracle-linux-9-mate-install-v1.0.0.iso
```

Expected output:

```text
a4f37b580f291a0ef3e856e14b661f5b63786ed20fee94385a477f5fdf68b1be
```

If the hash does not match, stop — re-download rather than troubleshoot a broken image later.

## 2. Create boot media

### Option A: bootable USB

Writing the ISO erases the target device. Check the device name with `lsblk` first, then replace `/dev/sdX` carefully:

```bash
sudo umount /dev/sdX?* 2>/dev/null || true
sudo dd if=oracle-linux-9-mate-install-v1.0.0.iso of=/dev/sdX \
  bs=16M status=progress conv=fsync
```

### Option B: virtual machine (recommended for a first try)

Create a fresh VM with:

- A **fresh virtual disk** (no data you care about)
- At least **4 GiB RAM**
- **UEFI/OVMF firmware** (the build also boots BIOS)
- The ISO attached as optical media

Boot it, and you should land on the Oracle Linux installer GRUB menu:

![Oracle Linux installer GRUB boot menu in a UEFI VM](/images/blog/oracle-linux-9-mate-install/01-grub.png)

Select the default *Install Oracle Linux* entry. As the kernel takes over, Anaconda's startup console scrolls by — this is normal and confirms the installer runtime is loading:

![Anaconda startup console output during installer boot](/images/blog/oracle-linux-9-mate-install/02-anaconda-console.png)

After a minute or two, the graphical **Installation Summary** appears:

![Anaconda Installation Summary hub at first launch](/images/blog/oracle-linux-9-mate-install/03-installation-summary.png)

## 3. Confirm the installation source

Open **Installation Source**. It should show the auto-detected local media with **no repository error**:

![Installation Source showing auto-detected local media with no error](/images/blog/oracle-linux-9-mate-install/04-installation-source.png)

If you see a base repository error here, your media is usually damaged or modified — verify the SHA256 again (see [troubleshooting](#7-troubleshooting)).

## 4. Select MATE Desktop

This is the whole point of the build. Open **Software Selection**, and under **Base Environment** you will find **MATE Desktop** alongside the stock environments:

![Software Selection listing MATE Desktop under Base Environment](/images/blog/oracle-linux-9-mate-install/05-software-selection-mate.png)

Select it. On the right, the environment resolves to its package groups and optional add-ons:

![MATE Desktop selected, with add-on options resolved](/images/blog/oracle-linux-9-mate-install/06-mate-selected.png)

Click **Done**. Back on the summary, configure the remaining spokes:

- **Time & Date** — pick your timezone; NTP works once networking is up:

![Time and Date configuration spoke](/images/blog/oracle-linux-9-mate-install/07-time-date.png)

- **Root Password** — this documentation run kept root **locked**, which is a safe default for desktop machines:

![Root account screen with the root account locked](/images/blog/oracle-linux-9-mate-install/08-root-password.png)

- **User Creation** — create a normal user (this run used `mateuser`). Make it an administrator if you want sudo:

![User creation form for a regular user account](/images/blog/oracle-linux-9-mate-install/09-user-creation.png)

Keep passwords out of any screenshots you take yourself.

Finally, select **Installation Destination** (choose the fresh disk with **Automatic** partitioning) and review the summary — everything configured and ready to begin:

![Installation Summary with MATE Desktop and user configured, ready to install](/images/blog/oracle-linux-9-mate-install/10-summary-mate-ready.png)

## 5. Install, reboot, log in

Click **Begin Installation** and let it finish. When complete, click **Reboot** — and **detach/eject the ISO first** so the VM boots from the installed disk instead of looping back into the installer.

On first boot you get the graphical login; sign in as your user and you land in a MATE session. Verify the panel, Caja, MATE Terminal, NetworkManager, logout, and reboot behave normally, then confirm from a terminal:

```bash
cat /etc/oracle-release
rpm -q mate-desktop mate-panel caja mate-terminal
echo "$XDG_CURRENT_DESKTOP"
echo "$XDG_SESSION_DESKTOP"
```

The package queries should return installed versions, and the session variables should identify a MATE session.

> **Honesty note:** the screenshot run above captured everything through the ready-to-install summary. Progress, completion, and first-login captures come from that same documentation pass only where listed; stages not shown here were simply not photographed rather than substituted from other runs. Your install will look exactly like any standard Oracle Linux install after this point.

## 6. How MATE got into the installer (short version)

Anaconda reads Base Environments from **comps XML** attached to the enabled DNF repositories — it does not hard-code the list. MATE's RPM stack already existed in the Oracle Linux 9 EPEL channel; what was missing was an `<environment>` definition for Anaconda to display.

The build pipeline:

```text
OL9 repos + EPEL MATE packages
        ↓
mate-desktop group + mate-desktop-environment environment (comps)
        ↓
DNF-resolved, dependency-closed package pool
        ↓
createrepo_c (merged comps metadata)
        ↓
Lorax → BIOS/UEFI ISO with valid .treeinfo (BaseOS variant)
        ↓
Anaconda shows "MATE Desktop" under Base Environment
```

Three fixes mattered along the way: keeping the product name `Oracle Linux` so Anaconda matches its product configuration, generating `.treeinfo` via productmd with the expected `BaseOS` variant, and explicitly including `grub2-efi-x64`, `shim-x64`, and `efibootmgr` so UEFI bootloader installation succeeds. **Anaconda itself was not modified** — the integration is entirely repository metadata, package pool completeness, and media construction.

Full details live in the repo docs: [how-mate-was-integrated.md](https://github.com/saurabhahuja71/oracle-linux-9-mate-install/blob/main/docs/how-mate-was-integrated.md), [production-build.md](https://github.com/saurabhahuja71/oracle-linux-9-mate-install/blob/main/docs/production-build.md), and [production-validation.md](https://github.com/saurabhahuja71/oracle-linux-9-mate-install/blob/main/docs/production-validation.md).

## 7. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| No MATE option in Software Selection | Wrong ISO — confirm the SHA256 checksum matches `a4f37b…b1be`. |
| Base repository error | Media damaged or modified; re-download and re-verify, and make sure Installation Source stays the local media. |
| UEFI bootloader installation fails | Use the production ISO unchanged — it includes `grub2-efi-x64`, `shim-x64`, and `efibootmgr`. |
| VM does not boot after install | The ISO is still attached. Detach it and set the installed disk as the first boot device. |
| No network after first boot | Use NAT or bridged networking in the VM and enable the connection via NetworkManager. |

## Two handy add-ons: blueman and Notepadqq

A fresh MATE desktop leaves room for a couple of extras I packaged for the same Oracle Linux 9 machines — both install straight through **dnf** from my GitHub Pages repositories, so future updates arrive with normal `dnf upgrade`:

### blueman — Bluetooth manager

A full Bluetooth manager (adapter pairing, audio devices, file transfer) that integrates cleanly with the MATE panel. Source and CI packaging: <https://github.com/saurabhahuja71/blueman>

```bash
sudo dnf install -y dnf-plugins-core
sudo yum-config-manager --add-repo=https://saurabhahuja71.github.io/blueman/blueman.repo
sudo dnf install -y blueman
```

### notepadqq — Notepad++-style editor

A Notepad++-like text editor built on Qt6/WebEngine. Its runtime libraries come from Oracle's EPEL and CodeReady Builder repos, so enable those first. Source and CI packaging: <https://github.com/saurabhahuja71/notepadqq>

```bash
sudo dnf install -y oracle-epel-release-el9
sudo dnf config-manager --set-enabled ol9_codeready_builder

sudo yum-config-manager --add-repo=https://saurabhahuja71.github.io/notepadqq/notepadqq.repo
sudo dnf install -y notepadqq
```

Both repositories are currently unsigned (`gpgcheck=0`) — dnf prints a warning on first install, which is expected. If you prefer not to add a repo, grab the RPMs from each project's GitHub Releases page instead and `sudo dnf install ./<package>.rpm` them.

## Links

- ISO download: <https://archive.org/download/oracle-linux-9-mate-install-v1.0.0/oracle-linux-9-mate-install-v1.0.0.iso>
- Internet Archive item: <https://archive.org/details/oracle-linux-9-mate-install-v1.0.0>
- Source & docs: <https://github.com/saurabhahuja71/oracle-linux-9-mate-install> (`v1.0.0`)
- blueman: <https://github.com/saurabhahuja71/blueman> · dnf repo: <https://saurabhahuja71.github.io/blueman/blueman.repo>
- notepadqq: <https://github.com/saurabhahuja71/notepadqq> · dnf repo: <https://saurabhahuja71.github.io/notepadqq/notepadqq.repo>
- SHA256: `a4f37b580f291a0ef3e856e14b661f5b63786ed20fee94385a477f5fdf68b1be`

As always: this is a community build for exploration, labs, and homelabs. For production Oracle Linux deployments, use the official Oracle Linux media and support channels.
