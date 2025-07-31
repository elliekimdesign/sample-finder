import requests
from bs4 import BeautifulSoup

def scrape_samples(artist_slug):
    url = f"https://www.whosampled.com/{artist_slug}/samples/?ob=0"
    headers = {"User-Agent": "Mozilla/5.0"}

    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")

    samples = soup.select(".trackListing .trackSample")

    print(f"\n🎵 Samples for {artist_slug.replace('-', ' ')} 🎵\n")
    for s in samples:
        title = s.select_one(".trackName").get_text(strip=True)
        sampled_artist = s.select_one(".trackArtist").get_text(strip=True)
        print(f"- {title} by {sampled_artist}")

# 사용자 입력 받기
artist_name = input("Enter artist name (e.g., J. Cole): ")
artist_slug = artist_name.strip().replace(" ", "-")
scrape_samples(artist_slug)

