[![Tailscale](https://img.shields.io/badge/Tailscale-Exit%20Node-blue?logo=vpn)] 
[![GL.iNet](https://img.shields.io/badge/GL-iNet-blue?logo=router)] [![RPi5](https://img.shields.io/badge/RPi-5-E30B5D?logo=Raspberrypi)] [![Cloudfare](https://img.shields.io/badge/Cloudfare-Worker-blue)] [![Slack](https://img.shields.io/badge/Slack-Notification-blue)]

# Tailscale for Network Security

Secure your devices with Tailscale—a WireGuard-based mesh VPN. Build private, encrypted networks without port forwarding, static IPs, or complex firewalls. **Hands-on guides** for home, travel, and public Wi-Fi using your own exit nodes.

## Table of Contents
- [Why Tailscale?](#why-tailscale)
- [Guides](#guides)
- [Comparison](#comparison)
- [Contributing](#contributing)
- [License](#license)

## Why Tailscale?
- **Strong Encryption**: End-to-end WireGuard crypto.
- **Zero Config**: NAT traversal, no ports/static IPs needed.
- **Exit Nodes**: Tunnel traffic via your Pi/home for safe public WiFi.
- **Cross-Platform**: iOS, Android, macOS, Linux, routers.

## Guides

Detailed step-by-steps included:

- **[RPi Exit Node](GUIDE_TAILSCALE_EXIT_NODE.md)**: Turn Raspberry Pi into VPN server. Connect iPad/laptop via Tailscale app on hotel WiFi.
- **[GL-MT3000 Travel Router](GUIDE_GL_MT3000_EXIT_NODE.md)**: Use GL.iNet router as client; route via Pi exit node (even for non-Tailscale devices).
- **[Cloudflare Monitor](GUIDE_CLOUDFLARE_MONITOR.md)**: Worker checks Pi status every 15min; Slack alerts on offline/online.

## Comparison

| Use Case | Guide | Hardware | Best For |
|----------|-------|----------|----------|
| Simple travel VPN | RPi Exit Node | Raspberry Pi (home) + iPad/phone | Personal devices on public WiFi |
| Locked-down laptops | GL-MT3000 Router | GL-MT3000 (travel) + Pi | Work devices via private WiFi hotspot |
| Proactive alerts | Cloudflare Monitor | Pi + Cloudflare free tier | Always-on uptime notifications |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT – see [LICENSE.md](LICENSE.md) file.

## Acknowledgments
- [Tailscale Docs](https://tailscale.com/kb/)
- [GL.iNet Forum](https://forum.gl-inet.com/)

---