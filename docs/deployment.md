# Production deployment notes

The API must not run as root. The sample systemd unit uses a dedicated account and grants only `CAP_NET_ADMIN` to the service process. The account must own the controller database, the WireGuard key files (private files mode `0600`), and the specific config path it is allowed to replace. Review this model with the Linux administrator before deployment; some distributions or customized `wg-quick` scripts can require a small root-owned helper instead.

If a helper is used, make it root-owned, non-writable by the service account, accept only a fixed interface/config path, validate every argument, and expose only `wg show`, `wg syncconf`, and the required `wg-quick` action. Do not give the Node process unrestricted sudo and do not edit `/etc/sudoers` from this project.

Install the repository at `/opt/WireGuard-VPN`, create `wireguard-controller` and `wireguard-dashboard` service accounts, then prepare:

```bash
sudo install -d -o wireguard-controller -g wireguard-controller -m 0700 /var/lib/wireguard-controller
sudo install -d -o wireguard-controller -g wireguard-controller -m 0700 /etc/wireguard-controller
sudo install -d -o wireguard-controller -g wireguard-controller -m 0700 /etc/wireguard
sudo install -o root -g root -m 0644 deploy/wireguard-controller.service /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/wireguard-dashboard.service /etc/systemd/system/
```

Put backend variables in `/etc/wireguard-controller/controller.env` with mode `0600`, frontend public variables in `/etc/wireguard-controller/dashboard.env`, run `npm ci` in both directories, run `npm run build` in `frontend`, and review `npm run setup:wireguard` before using `--apply`.

PM2 is suitable for lab/mock deployments and is started from the repository root with `pm2 start ecosystem.config.js`. PM2 manages Node processes only; it does not replace `wg-quick@wg0`, Linux capabilities, file ownership, routing, or firewall policy.

For the routed VMware lab, pfSense separates WAN/DMZ/LAN, has a return static route for `10.99.0.0/24` via the WireGuard server, and permits only intended `wg0` to LAN traffic. Do not NAT tunnel-to-LAN traffic. The controller never changes UFW, nftables, forwarding, or production firewall policy automatically.
