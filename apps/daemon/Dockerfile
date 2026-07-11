# Standalone ohd image. The SEA binary is built and verified by
# pack:sea on the host first (see scripts/pack-sea.mjs); this image
# only wraps it. The base must carry a glibc at least as new as the
# Node the binary was forged from — CI packs on ubuntu-latest, so the
# matching LTS base is the floor, not debian-slim.
FROM ubuntu:24.04

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
CMD ["run", "--data-dir", "/data", "--bind-address", "0.0.0.0", "--bind-port", "8137"]
