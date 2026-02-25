import urllib.request
url = "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=800&auto=format&fit=crop"
try:
    urllib.request.urlretrieve(url, "/Users/Helder/Desktop/2026/Hylix/toolhub/assets/pubmed_vis_card.png")
except Exception as e:
    print(f"Failed: {e}")
