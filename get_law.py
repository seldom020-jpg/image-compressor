import requests
from bs4 import BeautifulSoup
import warnings
warnings.filterwarnings("ignore")

url = "https://zh.wikipedia.org/zh-cn/%E4%B8%AD%E5%8D%8E%E4%BA%BA%E6%B0%E5%8D%8E%E5%92%8C%E5%9B%BD%E7%89%B9%E6%AE%8A%E8%AE%BE%E5%A4%87%E5%AE%89%E5%85%A8%E5%AE%89%E5%85%A8%E5%AE%89%E4%BA%9A%E5%AE%89%E5%85%A8"
response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')
content = soup.get_text()

# 提取第32条到第49条
lines = content.split('\n')
start = False
result = []
for line in lines:
    line = line.strip()
    if not line:
        continue
    if '第三十二条' in line:
        start = True
    if start:
        result.append(line)
        if '第四十九条' in line and '第五十条' not in line:
            break
    if len(result) > 200:
        break

print('\n'.join(result))
