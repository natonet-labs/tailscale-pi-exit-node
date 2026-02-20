[![Tailscale](https://img.shields.io/badge/Tailscale-blue?logo=vpn&logoColor=white)] [![GL.iNet](https://img.shields.io/badge/GL.iNet-MT3000-blue?logo=router&logoColor=white)] [![RPi](https://img.shields.io/badge/Raspberry%20Pi-5-E30B5D?logo=raspberrypi&logoColor=white)] [![Cloudflare](https://img.shields.io/badge/Cloudflare-Worker-orange?logo=cloudflare&logoColor=white)] [![Slack](https://img.shields.io/badge/Slack-teal?logo=slack&logoColor=white)]

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
- **Exit Nodes**: Tunnel traffic via your Pi/home for safe public Wi-Fi.
- **Cross-Platform**: iOS, Android, macOS, Linux, routers.

## Guides
- [![Ready](https://img.shields.io/badge/Ready-green)] **[RPi Exit Node](GUIDE_TAILSCALE_EXIT_NODE.md)**
- [![Ready](https://img.shields.io/badge/Ready-green)] **[GL-MT3000](GUIDE_GL_MT3000_EXIT_NODE.md)**
- [![Ready](https://img.shields.io/badge/Ready-green)] **[Cloudflare Monitor](GUIDE_CLOUDFLARE_MONITOR.md)**

## Comparison

| Use Case | Guide | Hardware | Best For |
|----------|-------|----------|----------|
| 📱 Simple VPN | RPi Exit Node | Pi + Phone | Personal travel |
| 💼 Work laptops | GL-MT3000 | Router + Pi | Locked-down devices |
| 🔔 Alerts | Cloudflare | Pi + Free tier | Uptime monitoring |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT – see [LICENSE.md](LICENSE.md) file.

## Acknowledgments
- [Tailscale Docs](https://tailscale.com/kb/)
- [GL.iNet Forum](https://forum.gl-inet.com/)

---