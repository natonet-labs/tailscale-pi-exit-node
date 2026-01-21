# Tailscale for Network Security

Tailscale is a secure, peer‑to‑peer VPN built on top of WireGuard that creates a private, encrypted mesh network (a “tailnet”) between your devices. It removes the need for manual port‑forwarding, dynamic DNS, or complex firewall rules, while giving you secure remote access and a way to tunnel all of your traffic through trusted devices you control.[^1] [^2]

This project collects practical guides for using Tailscale to secure your internet connection at home and while traveling.

## 1. Why Use Tailscale?

### 1.1 Strong Encryption by Default

- Tailscale uses the WireGuard protocol, which provides modern, efficient cryptography to encrypt traffic between your devices.[^1]
- Each device gets its own key pair and a stable 100.x.y.z address; connections are end‑to‑end encrypted between peers whenever possible.

### 1.2 No Port Forwarding or Static IP Required

- You do not need to open ports on your home router or buy static IP addresses.
- Tailscale handles NAT traversal, relays (DERP servers), and dynamic IP changes automatically, so devices can find each other securely over the internet.[^2]

### 1.3 Private Mesh Network (Tailnet)

- All your devices (laptops, phones, servers, Raspberry Pis, routers) can securely talk to each other as if they were on the same local network.[^1]
- Access is controlled centrally via your Tailscale account and admin console, including device approval and ACLs.

### 1.4 Exit Nodes (Your Own “VPN Server”)

- An exit node is a device that can send traffic out to the public internet on behalf of other devices in your tailnet.
- When you select an exit node, all of your internet traffic is encrypted from your device to that node, then exits from that node’s network (for example, your home).
- This lets you:
    - Securely use hotel, café, or airport WiFi (the local network only sees encrypted Tailscale traffic).[^2]
    - Make websites see your home IP instead of the foreign network’s IP.[^2]
    - Keep control over your own “VPN server” instead of paying a third‑party VPN provider.[^2]

### 1.5 Simple Cross‑Platform Clients

- Tailscale clients exist for iOS/iPadOS, Android, macOS, Windows, Linux, and many NAS/router platforms.
- You can quickly enable an exit node on a small always‑on device (like a Raspberry Pi) and use it from phones, tablets, and laptops when away from home.[^3]

## 2. Included Guides

This repo currently includes two detailed guides:

### 2.1 GL‑MT3000 as a Secure Travel Router

File: [gl-mt3000-exit-node.md](gl-mt3000-exit-node.md)

This guide explains how to:

- Use a GL‑MT3000 (Beryl AX) as a Tailscale client and subnet router.
- Connect the MT3000 to hotel/Airbnb WiFi and rebroadcast a private WiFi network for your devices.
- Route all traffic from devices connected to the MT3000 through a Tailscale exit node (for example, a Raspberry Pi at home).
- Configure manual DNS, Tailscale routes, and OpenWrt/LuCI firewall settings so LAN clients can successfully use the exit node.[^4] [^5] [^2]

This pattern is ideal when you cannot install software (like Tailscale) directly on your work laptop, but still want a fully encrypted tunnel back home via a travel router.

### 2.2 Raspberry Pi as a Home Exit Node

File: [tailscale-exit-node.md](tailscale-exit-node.md)

This guide focuses on:

- Installing and configuring Tailscale on a Raspberry Pi at home.
- Enabling the Pi as an exit node so it can act as your personal VPN server.
- Enabling IP forwarding, approving the exit node in the Tailscale Admin Console, and setting up DNS for smooth operation.
- Connecting an iPad (or other client) to Tailscale and selecting the Pi as the exit node to secure all traffic on untrusted networks.

This pattern is ideal when you just want a simple, portable “home VPN” — for example, using your Pi as the exit node while traveling with only your phone or tablet.[^3]

### 2.3 Cloudflare Worker Tailscale Monitor

File: [tailscale-monitor.md](tailscale-monitor.md)

This guide shows how to: 
- Build a Cloudflare Worker that periodically checks the status of a Tailscale device (i.e: Raspberry Pi exit node) and sends alerts to Slack when it goes offline or comes back online. 
- Uses a Tailscale OAuth client with read‑only device scope, a KV namespace to store the last known state, and a cron trigger so the Worker can run on a schedule without any always‑on server.

This pattern is ideal when you rely on a Raspberry Pi (or other node) as a critical exit node and want proactive notifications if it becomes unavailable, so you can fix issues before you discover your VPN is down while traveling.

## 3. When to Use Which Guide?

- Use tailscale-exit-node.md if you are starting from scratch and want to turn a Raspberry Pi at home into your primary secure exit node for devices like an iPad, laptop, or phone.
- Use gl-mt-3000-exit-node.md if you also own a GL‑MT3000 travel router and want a setup where even locked‑down work devices (that cannot run Tailscale) can still benefit from your Pi exit node by connecting through the router.[^5] [^4] [^2]
- Use tailscale-monitor.md if you want a Cloudflare Worker that watches your Pi exit node (via the Tailscale API) and sends Slack alerts whenever it goes offline or comes back online.

The guides build on the same core ideas:

1. A Tailscale tailnet for private, encrypted connectivity between your devices.[^1]
2. One or more exit nodes you control.
3. Consistent DNS handling and safe firewall configuration to avoid “internet is offline” issues when the exit node is enabled.[^6] [^4] [^5]

***

Sources:

[^1]: https://tailscale.com/kb/1017/what-is-tailscale/

[^2]: https://thewirednomad.com/tailscale

[^3]: https://forum.gl-inet.com/t/gl-mt3000-tailscale-custom-exit-node/53501

[^4]: https://blog.cmmx.de/2025/04/16/tailscale-subnet-on-a-glinet-beryl-ax-gl-mt3000/

[^5]: https://forum.gl-inet.com/t/cannot-connect-mt-3000-to-tailscale-exit-node/51686

[^6]: https://forum.gl-inet.com/t/gl-mt3000-stops-working-when-connecting-to-tailscale-exit-node/34146
