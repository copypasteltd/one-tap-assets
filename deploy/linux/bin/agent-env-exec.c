/* No privileges. A systemd role reads its root-created private environment once
 * and replaces itself with the pinned native runtime. Secrets never appear in
 * systemd unit properties or command arguments. */
#define _GNU_SOURCE
#include <sys/resource.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

int main(int argc, char **argv) {
  if (argc < 3) return 125;
  int fd = open(argv[1], O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  struct stat info;
  if (fd < 0 || fstat(fd, &info) || !S_ISREG(info.st_mode) || info.st_uid != 0
      || info.st_nlink != 1 || info.st_size <= 0 || info.st_size > 65536) return 125;
  size_t size = (size_t)info.st_size, offset = 0;
  char *bytes = calloc(size + 1, 1);
  if (!bytes) return 125;
  while (offset < size) {
    ssize_t count = read(fd, bytes + offset, size - offset);
    if (count <= 0) return 125;
    offset += (size_t)count;
  }
  close(fd);
  if (bytes[size - 1] || clearenv()) return 125;
  for (offset = 0; offset < size;) {
    char *entry = bytes + offset;
    size_t length = strlen(entry);
    char *equal = strchr(entry, '=');
    if (!equal || equal == entry || length == 0) return 125;
    *equal = 0;
    if (setenv(entry, equal + 1, 1)) return 125;
    offset += length + 1;
  }
  explicit_bzero(bytes, size);
  free(bytes);
  struct rlimit core = {0, 0};
  if (setrlimit(RLIMIT_CORE, &core)) return 125;
  execv(argv[2], argv + 2);
  return 126;
}
