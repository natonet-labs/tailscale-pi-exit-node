# Secure Public WiFi with GL‑MT3000 + Raspberry Pi (Tailscale Exit Node)

This guide walks through configuring:

- A **Raspberry Pi at home** as a Tailscale exit node.
- A **GL‑MT3000 (Beryl AX)** as a Tailscale subnet router and travel router.
- The MT3000’s **LAN clients (your work laptop, iPad, etc.)** to send all traffic through the Pi exit node using **Custom Exit Node**.

No prior networking knowledge is assumed.

***

## 1. Overview of the Setup

Traffic flow when you are at a hotel:

1. Hotel WiFi → MT3000 WAN (Repeater mode).
2. Your work laptop → MT3000 WiFi/LAN (gets IP like `192.168.8.x`).
3. MT3000 → Tailscale → Raspberry Pi at home (exit node).
4. Raspberry Pi → Internet.

So the hotel only sees encrypted Tailscale traffic; browsing appears to come from your home IP.[^1] [^2]

***

## 2. Prerequisites

You need:

- Raspberry Pi (4B/5) at home, running Linux and online.
- GL‑MT3000 (Beryl AX) with fairly recent GL.iNet firmware (4.x).
- A Tailscale account (free plan is fine).
- Basic SSH access to both Pi and MT3000.

***

## 3. Configure Raspberry Pi as Tailscale Exit Node

### 3.1 Install Tailscale

On the Pi:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Confirm OS if needed with:

```bash
cat /etc/os-release
```

Follow any OS-specific steps from Tailscale docs if the script asks.[^2] [^1]

### 3.2 Enable IP forwarding on the Pi

```bash
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
```

This allows the Pi to actually route traffic for other devices.[^1] [^2]

### 3.3 Bring up Tailscale with exit node

On the Pi:

```bash
sudo tailscale up --advertise-exit-node --accept-routes
```

Then, in the **Tailscale Admin Console**:

1. Go to **Machines**.
2. Find the Pi (for example, `playhub`).
3. Click the **three dots → Edit route settings**.
4. Check **Use as exit node**.
5. Optionally **Disable key expiry** for the Pi so it stays authorized.[^2] [^1]

Verify from another device (e.g., your iPad with Tailscale app) that selecting the Pi as exit node works and internet browsing is fine.

***

## 4. Base Setup of GL‑MT3000 as Tailscale Client + Subnet Router

### 4.1 Connect MT3000 to your home network

At home, connect:

- MT3000 WAN to your home router **or**
- MT3000 as WiFi repeater to your home WiFi.

Then open `http://192.168.8.1` in a browser and log into the GL.iNet admin UI.[^3]

### 4.2 Enable Tailscale on MT3000

1. In GL.iNet UI, go to **Applications → Tailscale**.[^3]
2. **Enable** Tailscale.
3. Bind/login to your Tailscale account.
4. Make sure **Allow Remote Access LAN** and **Allow Remote Access WAN** are enabled while testing basic connectivity (these toggles may disappear after Custom Exit Node is enabled, which is okay later).[^4] [^5]

In the Tailscale Admin Console, you should now see a new device like `gl-mt3000` with a 100.x.x.x address.[^3]

### 4.3 Set manual DNS on MT3000

This avoids DNS breakage when exit nodes are used.

1. In GL.iNet UI, go to **Network → DNS**.
2. Set **Mode: Manual**.
3. Set DNS servers:
    - DNS Server 1: `8.8.8.8` (Google).
    - DNS Server 2 (optional): `1.1.1.1` (Cloudflare).
4. Leave **DNS Rebinding Attack Protection** off for this setup if it causes issues.
5. You can keep “Override DNS Settings of All Clients” and “Allow Custom DNS to Override VPN DNS” **on** so the manual DNS applies consistently when the VPN is active.[^6] [^2]

This ensures the router and LAN clients use known-good public DNS.

***

## 5. Advertise the MT3000 LAN Subnet via Tailscale

The MT3000 must publish its LAN (default `192.168.8.0/24`) into the tailnet so that LAN devices behind it can be routed through the tunnel.[^7] [^2]

### 5.1 Advertise routes from MT3000

SSH into the MT3000:

```bash
ssh root@192.168.8.1
```

Then run:

```bash
tailscale up --advertise-routes=192.168.8.0/24 --accept-routes --accept-dns=false
```

- `--advertise-routes=192.168.8.0/24` tells Tailscale that MT3000 can route this subnet.
- `--accept-routes` lets it accept any routes from other nodes.
- `--accept-dns=false` prevents Tailscale from overriding your manual DNS.[^8] [^2]

> Note: The GL.iNet script may also internally build an extra aggregate route such as `192.168.4.0/22` that you’ll see later in the admin console.[^9] [^7]

### 5.2 Approve routes in the Tailscale Admin Console

1. Go to **Machines** in Tailscale Admin Console.
2. Find **gl‑mt3000**.
3. Click **three dots → Edit route settings**.
4. You’ll likely see:
    - `192.168.8.0/24`
    - Possibly `192.168.4.0/22` (a supernet derived from its configs).
5. **Enable/approve only the route you actually need**:
    - Keep `192.168.8.0/24` checked.
    - **Uncheck** `192.168.4.0/22` unless you intentionally want that broader range.[^9] [^7]

This keeps routing clean and avoids exporting unnecessary internal ranges.

***

## 6. Critical Firewall Adjustment in LuCI (WAN zone covers Tailscale)

By default, GL.iNet’s Tailscale integration does **not** route LAN client traffic through exit nodes correctly; only the router itself can use the exit node. The fix is to teach the firewall that `tailscale0` belongs to the WAN side.[^10] [^7]

### 6.1 Open LuCI

1. In GL.iNet UI, go to **System → Advanced Settings → Go to LuCI** (OpenWrt).
2. Log in with the same router password.[^7] [^2]

### 6.2 Add `tailscale0` to WAN zone “covered devices”

1. In LuCI, navigate to **Network → Firewall**.
2. You should see three default zones listed roughly as:
    - `lan → wan`
    - `wan → REJECT`
    - `guest → wan`[^6] [^2]
3. Click **Edit** on the second one (`wan → REJECT`).
4. Go to the **Advanced Settings** tab.
5. Find **Covered Devices** (or similar dropdown).
6. Add/select **`tailscale0`** as a covered device.
7. Click **Save**, then **Save \& Apply**.[^6] [^2]

This effectively says: “Treat the Tailscale interface like part of the WAN zone,” allowing routing between LAN and Tailscale → WAN.

### 6.3 Reboot the router

Do a full reboot so all firewall and Tailscale settings reload cleanly:

- In GL.iNet UI: **System → Reboot**, or
- Via SSH:

```bash
reboot
```

After the reboot, Tailscale should auto-start (from the GL.iNet app) and the firewall will have the updated zone mapping.[^2] [^6]

***

## 7. Enable Custom Exit Node to Use the Pi

Now that:

- The Pi is a working exit node.
- The MT3000 advertises `192.168.8.0/24`.
- The MT3000 firewall knows `tailscale0` belongs in the WAN zone.

You can tell the MT3000 to send **all its traffic and LAN clients’ traffic** through the Pi.

### 7.1 Select the Pi as Custom Exit Node

1. In GL.iNet UI, go to **Applications → Tailscale**.
2. Ensure Tailscale is **Enabled** (green).
3. Look for **Custom Exit Node**:
    - Turn it **ON**.
    - Click the **refresh** icon next to the dropdown.
    - Select your **Raspberry Pi’s Tailscale IP** (`100.84.59.113` in your case).
    - Click **Apply**.[^6] [^2]

You may see a warning like:

> “If you enable Custom Exit Node, the device will forward all requests to the Exit Node. Before enabling, you must enable subnet routes 192.168.8.0/24 of this device in Tailscale Admin Console…”

You already did this in section 5.2, so this requirement is satisfied.

***

## 8. Testing the Setup

### 8.1 Basic connectivity from MT3000

SSH into the MT3000 again (after Custom Exit Node is enabled) and test:

```bash
ping -c 3 8.8.8.8
curl -I https://google.com
```

If these work, the router itself is successfully using the Pi exit node.[^11]

### 8.2 Test from a LAN client (iPad / laptop)

1. Connect your iPad or laptop to the MT3000 WiFi (not directly to hotel or home WiFi).
2. Visit `https://icanhazip.com` or `https://ifconfig.io` in a browser.
3. Confirm the reported public IP matches your **home** IP (where the Pi lives), not the hotel network.[^2]
4. Open websites normally (e.g., google.com). They should work.

Optionally, if you have a ping app or terminal on the client:

- Ping the Pi Tailscale IP: `100.84.59.113`.
- Ping the MT3000 Tailscale IP (`100.78.133.87` from your earlier output).
- Ping a public IP like `8.8.8.8`.

All should succeed.

***

## 9. Notes on the 192.168.4.0/22 Supernet

In the Tailscale Admin Console under the MT3000’s route settings you saw:

- `192.168.8.0/24`
- `192.168.4.0/22`

The `192.168.4.0/22` route is an **aggregate supernet** generated by GL.iNet’s logic that covers several internal ranges (192.168.4.x–192.168.7.x).[^9] [^7]

For your travel use case:

- **You only need `192.168.8.0/24`** to cover the MT3000 LAN.
- It is best to **uncheck/disable** `192.168.4.0/22` in the Tailscale route settings for the MT3000 to avoid exporting extra, unused ranges.[^7] [^9]

This does not break anything in your working setup; it simply keeps routing clearer.

***

## 10. What to Do When Traveling (Hotel / Airbnb)

When you’re on the road:

1. **Power the Pi at home** and ensure it’s online and visible in Tailscale.
2. At the hotel, power the MT3000 and connect to:
    - Hotel WiFi using **Repeater** mode in GL.iNet’s **Internet** page.[^3] [^2]
3. Confirm the MT3000 has internet (check from its admin UI).
4. Ensure Tailscale is **enabled** on the MT3000 and **Custom Exit Node** is set to the Pi.
5. Connect your work laptop/iPad to the MT3000 WiFi.
6. All traffic from that device now goes:
`Device → MT3000 → Tailscale → Raspberry Pi → Internet`.

Your traffic is encrypted across the hotel network, and sites see your home IP.[^1] [^2]

***

Sources:

[^1]: https://tailscale.com/kb/1408/quick-guide-exit-nodes

[^2]: https://thewirednomad.com

[^3]: https://docs.gl-inet.com/router/en/4/interface_guide/tailscale/

[^4]: https://forum.gl-inet.com/t/how-to-configure-gl-inet-router-to-host-tailscale-exit-node/65958

[^5]: https://www.reddit.com/r/Tailscale/comments/15x6kqr/tailscale_in_glinet_beryl_ax_need_help/

[^6]: https://forum.gl-inet.com/t/mt3000-4-4-6-rel-2-tailscale-internet-not-working-with-custom-exit-node/35528

[^7]: https://blog.cmmx.de/2025/04/16/tailscale-subnet-on-a-glinet-beryl-ax-gl-mt3000/

[^8]: https://www.reddit.com/r/Tailscale/comments/1dc9kxe/how_to_get_tailscale_working_as_subnet_router_on/

[^9]: https://www.reddit.com/r/GlInet/comments/1eg4oz3/beryl_ax_brume_2_tailscale_help/

[^10]: https://www.reddit.com/r/GlInet/comments/1p7k8i1/beryl_ax_mt3000_lan_cannot_reach_tailscale/

[^11]: https://forum.gl-inet.com/t/gl-mt3000-stops-working-when-connecting-to-tailscale-exit-node/34146

[^12]: https://www.reddit.com/r/Tailscale/comments/1g6hes3/set_up_glinet_travel_router_to_route_all_traffic/

[^13]: https://www.reddit.com/r/Tailscale/comments/19e1vxx/use_glmt3000_as_exit_node_in_tailscale/

[^14]: https://www.youtube.com/watch?v=vClieZkca3o

[^15]: https://www.reddit.com/r/Tailscale/comments/1k7x75s/tailscale_with_exit_node_doesnt_work_on_glinet/

[^16]: https://forum.gl-inet.com/t/tailscale-exit-node-not-working/33458

[^17]: https://www.reddit.com/r/Tailscale/comments/18za2xo/trouble_using_exit_nodes_with_router_glinet/

[^18]: https://www.reddit.com/r/GlInet/comments/1oq69nv/beryl_ax_tailscale_no_route_to_1921681024/nnjf8ay/
