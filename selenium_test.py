from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# 크롬 브라우저 열기 (화면 없이 headless로 실행)
options = webdriver.ChromeOptions()
# options.add_argument("--headless")  # 브라우저 창 없이 실행
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# URL 접속 (아티스트 이름은 적절히 변경 가능)
artist = "Kanye-West"
url = f"https://www.whosampled.com/{artist}/samples/?ob=0"
driver.get(url)

# HTML 소스 가져오기
html = driver.page_source
soup = BeautifulSoup(html, 'html.parser')

# HTML 구조 보기
print("===== RAW HTML START =====")
print(soup.prettify())
print("===== RAW HTML END =====")

# 예시로 .trackName 이 있는지 출력
track_names = soup.select('.trackName')
print(f"trackName 개수: {len(track_names)}")
for t in track_names[:5]:
    print("🎵", t.text.strip())

# driver.quit()
input("브라우저를 닫으려면 Enter를 누르세요.")