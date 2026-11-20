#!/bin/bash
# A terminal's shell (this script, on its own pty) and what runs in it.
# Dumps the /proc files a reader would read, with bash builtins only so
# the dump starts no process of its own inside the listing.
OUT=/w/proc-dump.txt

sleep 300 &
STAYS=$!

# Its child burns a second of CPU and exits; the parent waits, then stays.
bash -c 'timeout 1 sh -c "while :; do :; done"; exec sleep 300' &
WAITED=$!

# Outlives its parent on the same terminal: reparented away from this shell.
bash -c 'sleep 300 & disown'

sleep 2

{
  printf '==> note <==\nroot=%s stays=%s waited=%s\n' "$$" "$STAYS" "$WAITED"
  printf '==> file /proc/stat <==\n%s\n' "$(</proc/stat)"
  printf '==> dir /proc <==\n'
  for entry in /proc/[0-9]*; do printf '%s\n' "${entry#/proc/}"; done
  for entry in /proc/[0-9]*; do
    pid=${entry#/proc/}
    [ -r "$entry/stat" ] || continue
    printf '==> file %s/stat <==\n%s\n' "$entry" "$(<"$entry/stat")"
    printf '==> file %s/status <==\n%s\n' "$entry" "$(<"$entry/status")"
    if link=$(readlink "$entry/exe" 2>/dev/null); then
      printf '==> link %s/exe <==\n%s\n' "$entry" "$link"
    else
      printf '==> refused %s/exe <==\n' "$entry"
    fi
    printf '==> dir %s/task <==\n' "$entry"
    for task in "$entry"/task/[0-9]*; do printf '%s\n' "${task##*/}"; done
    for task in "$entry"/task/[0-9]*; do
      [ -r "$task/children" ] && printf '==> file %s/children <==\n%s\n' "$task" "$(<"$task/children")"
    done
  done
} >"$OUT"
