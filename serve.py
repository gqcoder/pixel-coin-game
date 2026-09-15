#!/usr/bin/env python3
"""
本地静态HTTP服务器 - 供局域网访问测试
用法: python3 serve.py [端口号]
默认端口: 8000
"""
import http.server
import socketserver
import socket
import sys
import os

def get_local_ip():
    """获取本机局域网IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    # 切换到脚本所在目录（game_test根目录）
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    
    # 使用简单的HTTP服务器，支持正确的MIME类型
    Handler = http.server.SimpleHTTPRequestHandler
    Handler.extensions_map.update({
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.html': 'text/html',
        '.png': 'image/png',
        '.manifest': 'text/cache-manifest',
    })
    
    with socketserver.TCPServer(("", port), Handler) as httpd:
        local_ip = get_local_ip()
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"🎮 像素金币游戏 - 本地服务器启动")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"")
        print(f"📱 局域网访问地址:")
        print(f"   http://{local_ip}:{port}")
        print(f"")
        print(f"💻 本机访问地址:")
        print(f"   http://localhost:{port}")
        print(f"")
        print(f"📋 提示:")
        print(f"   - 确保手机和电脑在同一WiFi")
        print(f"   - 手机浏览器输入局域网地址")
        print(f"   - 可用二维码工具生成上述URL")
        print(f"   - 按 Ctrl+C 停止服务器")
        print(f"")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 服务器已停止")

if __name__ == "__main__":
    main()
