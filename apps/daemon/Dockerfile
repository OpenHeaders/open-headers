# Standalone ohd image. The SEA binary is built and verified by
# pack:sea on the host first (see scripts/pack-sea.mjs); this image
# only wraps it. The base must carry a glibc at least as new as the
# Node the binary was forged from — CI packs on ubuntu-latest, so the
# matching LTS base is the floor, not debian-slim.
FROM ubuntu:24.04

# ghcr links the package to this repo (and shows its README) — the
# public release home, not the repo the workflow ran in.
ARG OHD_VERSION=dev
LABEL org.opencontainers.image.source=https://github.com/OpenHeaders/open-headers
LABEL org.opencontainers.image.description="OpenHeaders - Team Server Daemon (ohd)"
LABEL org.opencontainers.image.licenses=Apache-2.0
# Without this the label is inherited from the ubuntu base (24.04).
LABEL org.opencontainers.image.version=$OHD_VERSION

# ca-certificates: the daemon fetches HTTP(S) sources at refresh time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --user-group openheaders \
  && mkdir /data \
  && chown openheaders:openheaders /data

COPY dist-sea/ohd /usr/local/bin/ohd

USER openheaders
VOLUME /data
EXPOSE 8137

ENTRYPOINT ["/usr/local/bin/ohd"]
# In-container 0.0.0.0 is what makes -p mapping work; the operator's
# published port decides the real exposure (the default recipe maps
# 127.0.0.1:8137:8137 — loopback-only, ohd's native posture). TLS
# stays the reverse-proxy's job, per the daemon's bind law.
CMD ["run", "--data-dir", "/data", "--bind-address", "0.0.0.0", "--bind-port", "8137", "--allow-insecure-lan"]
