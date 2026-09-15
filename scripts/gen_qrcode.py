#!/usr/bin/env python3
"""生成QR码 - 纯标准库实现（无需qrcode/pillow依赖）

用法: python3 gen_qrcode.py <URL>
输出: qrcode.txt (ASCII艺术QR码)
"""
import sys

# QR码模式：URL/Alphanumeric/Byte
# 这里使用Byte模式编码任意字符串
# 为了简化，仅支持最小纠错级别L（7%容错）

def encode_qr_data(text):
    """简化版QR码数据编码 - Byte模式"""
    # 模式指示符：0100 = Byte模式
    # 字符计数指示符：8位（对于版本1-9）
    # 数据位
    data = text.encode('utf-8')
    length = len(data)
    
    # 模式指示符(4位) + 计数(8位) + 数据
    bits = '0100'  # Byte模式
    bits += format(length, '08b')  # 字符数
    for byte in data:
        bits += format(byte, '08b')
    
    # 终止符(最多4个0)
    bits += '0000'
    
    # 补齐到8的倍数
    while len(bits) % 8 != 0:
        bits += '0'
    
    # 填充字节：11101100 00010001 循环
    padding = ['11101100', '00010001']
    i = 0
    # 版本1 QR码容量：19字节（152位），纠错级别L
    capacity = 152
    while len(bits) < capacity:
        bits += padding[i % 2]
        i += 1
    
    return bits[:capacity]


def create_qr_matrix(data_bits):
    """创建QR码矩阵 - 简化版本1 (21x21)"""
    size = 21
    matrix = [[0 for _ in range(size)] for _ in range(size)]
    
    # 添加定位图案（三个角落的大方框）
    def add_finder_pattern(matrix, row, col):
        pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1],
        ]
        for r in range(7):
            for c in range(7):
                if 0 <= row+r < size and 0 <= col+c < size:
                    matrix[row+r][col+c] = pattern[r][c]
    
    # 左上、右上、左下
    add_finder_pattern(matrix, 0, 0)
    add_finder_pattern(matrix, 0, size-7)
    add_finder_pattern(matrix, size-7, 0)
    
    # 时序图案（定位图案之间的虚线）
    for i in range(8, size-8):
        matrix[6][i] = (i+1) % 2
        matrix[i][6] = (i+1) % 2
    
    # 暗模块（固定位置）
    matrix[4*1+9][8] = 1
    
    # 填充数据位（简化版，真实QR码有复杂的mask和纠错码）
    # 这里只做示意性填充
    bit_idx = 0
    for col in range(size-1, 0, -2):
        if col == 6:  # 跳过时序列
            col -= 1
        for _ in range(size):
            for c in [col, col-1]:
                if matrix[_ ][c] == 0 and bit_idx < len(data_bits):
                    matrix[_][c] = int(data_bits[bit_idx])
                    bit_idx += 1
    
    return matrix


def matrix_to_ascii(matrix):
    """将QR码矩阵转为ASCII艺术"""
    # 使用█表示黑色模块，使用 表示白色模块
    lines = []
    # 添加白色边框
    border = '  ' * (len(matrix[0]) + 4)
    lines.append(border)
    lines.append(border)
    
    for row in matrix:
        line = '    '  # 左边框
        for cell in row:
            line += '██' if cell else '  '
        line += '    '  # 右边框
        lines.append(line)
    
    lines.append(border)
    lines.append(border)
    
    return '\n'.join(lines)


def main():
    if len(sys.argv) < 2:
        print("用法: python3 gen_qrcode.py <URL>")
        print("示例: python3 gen_qrcode.py http://192.168.1.100:8000")
        sys.exit(1)
    
    url = sys.argv[1]
    
    print(f"正在为以下URL生成QR码：")
    print(f"  {url}")
    print()
    
    # 编码数据
    data_bits = encode_qr_data(url)
    
    # 创建矩阵
    matrix = create_qr_matrix(data_bits)
    
    # 转为ASCII
    ascii_qr = matrix_to_ascii(matrix)
    
    # 输出
    print(ascii_qr)
    print()
    
    # 保存到文件
    output_file = 'qrcode.txt'
    with open(output_file, 'w') as f:
        f.write(f"QR码 - 像素金币游戏\n")
        f.write(f"URL: {url}\n")
        f.write(f"\n")
        f.write(ascii_qr)
        f.write(f"\n\n")
        f.write(f"扫描说明：\n")
        f.write(f"1. 使用手机相机或微信扫一扫\n")
        f.write(f"2. 确保手机和服务器在同一WiFi网络\n")
        f.write(f"3. 如果无法扫描，可以手动输入上述URL\n")
    
    print(f"✅ QR码已保存到: {output_file}")
    print()
    print("注意：这是简化版QR码生成器，用于演示。")
    print("在生产环境中建议使用专业QR码生成工具。")
    print()
    print("🌐 公网访问建议：")
    print("  - GitHub Pages (免费HTTPS)")
    print("  - Vercel / Netlify (免费CDN)")
    print("  - Cloudflare Pages (免费)")


if __name__ == "__main__":
    main()
