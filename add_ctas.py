import random
import re

file_path = 'threads-bulk-posts.md'

ctas = [
    "👉 프로필 링크에서 내 사주/운세 확인하기",
    "👉 궁금하면? 프로필 링크 클릭!",
    "👉 더 자세한 풀이는 프로필 링크에서!",
    "👉 내 운세가 궁금하다면? (프로필 링크)",
    "👉 프로필 링크에서 확인해봐!",
    "👉 남들 다 보는 운세, 너만 안 볼 거야? (프로필 링크)",
    "👉 3초 만에 내 운세 보기 (프로필 링크)",
    "👉 프로필 링크로 오세요!",
    "👉 지금 바로 프로필 링크에서 확인!",
    "👉 족집게 운세는 프로필 링크에!"
]

def add_ctas():
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by separator
    posts = content.split('---')
    
    new_posts = []
    
    for post in posts:
        if not post.strip():
            new_posts.append(post)
            continue
            
        # Check if CTA already exists
        if "👉" in post:
            new_posts.append(post)
            continue
            
        # Find the hashtag line
        # Regex to find a line starting with #, potentially with whitespace before it
        lines = post.split('\n')
        hashtag_index = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('#'):
                hashtag_index = i
                break
        
        if hashtag_index != -1:
            # Insert CTA before hashtags
            cta = random.choice(ctas)
            
            # Ensure proper spacing: Content -> Blank -> CTA -> Hashtags
            # Or Content -> CTA -> Hashtags
            # Let's try to put it right before hashtags, ensuring a blank line before CTA if not present
            
            # Check line before hashtags
            if hashtag_index > 0 and lines[hashtag_index-1].strip() != "":
                 lines.insert(hashtag_index, "")
                 hashtag_index += 1
            
            lines.insert(hashtag_index, cta)
            new_posts.append('\n'.join(lines))
        else:
            # If no hashtags found (shouldn't happen for valid posts), just append
            new_posts.append(post)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('---'.join(new_posts))

if __name__ == "__main__":
    add_ctas()
    print("CTAs added successfully.")
