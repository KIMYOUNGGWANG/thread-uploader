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

def fix_ctas():
    # 1. Read and Clean (Remove all existing CTA lines)
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    cleaned_lines = [line for line in lines if not line.strip().startswith("👉")]
    content = "".join(cleaned_lines)

    # 2. Re-process to add CTAs correctly
    posts = content.split('---')
    new_posts = []
    
    for post in posts:
        if not post.strip():
            new_posts.append(post)
            continue
            
        post_lines = post.split('\n')
        hashtag_index = -1
        
        # Find the hashtag line
        # Condition: Starts with #, NOT ##, NOT # Space
        for i, line in enumerate(post_lines):
            stripped = line.strip()
            if stripped.startswith('#') and not stripped.startswith('##') and not stripped.startswith('# '):
                hashtag_index = i
                break
        
        if hashtag_index != -1:
            cta = random.choice(ctas)
            # Ensure blank line before CTA if not present
            if hashtag_index > 0 and post_lines[hashtag_index-1].strip() != "":
                post_lines.insert(hashtag_index, "")
                hashtag_index += 1
            
            post_lines.insert(hashtag_index, cta)
            new_posts.append('\n'.join(post_lines))
        else:
            # No hashtag line found (e.g. file header or empty sections)
            new_posts.append(post)

    # 3. Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('---'.join(new_posts))

if __name__ == "__main__":
    fix_ctas()
    print("CTAs fixed and re-added successfully.")
