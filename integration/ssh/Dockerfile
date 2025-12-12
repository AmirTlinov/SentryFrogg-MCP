FROM alpine:3.20

RUN apk add --no-cache openssh-server bash && \
    adduser -D -h /home/mcp -s /bin/sh mcp && \
    echo "mcp:mcp_pass" | chpasswd && \
    mkdir -p /home/mcp/.ssh && \
    chown -R mcp:mcp /home/mcp/.ssh && \
    ssh-keygen -A

EXPOSE 22

CMD ["/usr/sbin/sshd","-D","-e"]
