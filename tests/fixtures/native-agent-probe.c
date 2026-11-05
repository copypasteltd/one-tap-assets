/* Synthetic model, real kernel confinement probe. Not a Codex/model admission. */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>

static int readable(const char *path) {
  int fd = open(path, O_RDONLY);
  if (fd < 0) return 0;
  close(fd); return 1;
}
static int writable(const char *path) {
  int fd = open(path, O_WRONLY | O_CREAT, 0600);
  if (fd < 0) return 0;
  close(fd); return 1;
}
static int connection(int port) {
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) return 0;
  struct timeval limit = {1, 0};
  setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &limit, sizeof(limit));
  struct sockaddr_in address = {.sin_family = AF_INET, .sin_port = htons((unsigned short)port)};
  inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
  int okay = connect(fd, (struct sockaddr *)&address, sizeof(address)) == 0;
  close(fd); return okay;
}
int main(void) {
  char input[4096], config[4096], skills[4096], output[4096];
  const char *home = getenv("CODEX_HOME");
  if (!home) return 1;
  snprintf(input, sizeof(input), "%s/../work/input.json", home);
  snprintf(config, sizeof(config), "%s/config.toml", home);
  snprintf(skills, sizeof(skills), "%s/skills/probe/SKILL.md", home);
  snprintf(output, sizeof(output), "%s/../work/output.json", home);
  pid_t shell = fork();
  if (shell == 0) { execl("/bin/sh", "sh", "-c", "exit 0", NULL); _exit(126); }
  int status = 0;
  waitpid(shell, &status, 0);
  pid_t descendant = fork();
  if (descendant == 0) { while (1) pause(); }
  printf("{\"uid\":%u,\"child_pid\":%d,\"own_input_read\":%d,\"own_output_write\":%d,"
         "\"config_write_denied\":%d,\"skills_write_denied\":%d,\"other_workspace_denied\":%d,"
         "\"root_credentials_denied\":%d,\"shell_exec_denied\":%d,\"gateway_connect\":%d,\"db_connect_denied\":%d}\n",
         (unsigned)getuid(), (int)descendant, readable(input), writable(output), !writable(config), !writable(skills),
         !readable("/opt/one-tap-assets/app/runtime/agent-instances/native-probe-neighbor/private.txt"),
         !readable("/root/cfg/one-tap-assets/app.env"), WIFEXITED(status) && WEXITSTATUS(status) == 126,
         connection(38410), !connection(35432));
  fflush(stdout);
  char line[65536];
  while (fgets(line, sizeof(line), stdin)) {
    if (!strncmp(line, "exit", 4)) break;
  }
  /* Deliberately leave the descendant behind; native cleanup must kill it. */
  return 0;
}
