from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup

# Get user input for search type and keyword
search_type = input("Enter search type (artist/song): ").strip().lower()
keyword = input("Enter the name (artist or song title): ").strip()
formatted_keyword = keyword.replace(" ", "-")

# Construct URL based on search type
if search_type == "artist":
    url = f"https://www.whosampled.com/{formatted_keyword}/samples/?ob=0"
elif search_type == "song":
    url = f"https://www.whosampled.com/songs/{formatted_keyword}/samples/?ob=0"
else:
    print("Please enter a valid search type: 'artist' or 'song'")
    exit()

# Set up Selenium Chrome options
options = Options()
options.add_argument("--headless")  # Run Chrome in headless mode (no GUI)
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")

# Initialize WebDriver
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# Load the URL
driver.get(url)

# Get the rendered page source after JS execution
html = driver.page_source

# Parse with BeautifulSoup
soup = BeautifulSoup(html, "html.parser")

# Select elements containing track info
titles = soup.select(".trackName")
years = soup.select(".trackYear")
artists = soup.select(".trackArtistName")

print(f"\n🎵 Samples for {keyword} 🎵\n")

# Print the scraped samples (limit to first 10 for readability)
for title, year, sampled_artist in zip(titles[:10], years[:10], artists[:10]):
    print(f"{title.text.strip()} ({year.text.strip()}) by {sampled_artist.text.strip()}")

# Quit the browser
driver.quit()
