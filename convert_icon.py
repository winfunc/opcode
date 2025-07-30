from PIL import Image
import os

# PNG 파일을 ICO로 변환
png_path = r"D:\claudia\src-tauri\icons\icon.ico"  # 실제로는 PNG 파일
ico_path = r"D:\claudia\src-tauri\icons\icon_new.ico"

# PNG 파일 열기
img = Image.open(png_path)

# 다양한 크기 생성
sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
imgs = []

for size in sizes:
    img_resized = img.resize(size, Image.Resampling.LANCZOS)
    imgs.append(img_resized)

# ICO 파일로 저장
imgs[0].save(ico_path, format='ICO', sizes=sizes, append_images=imgs[1:])

print(f"Converted to {ico_path}")

# 원본 파일 백업
os.rename(png_path, png_path + ".bak")

# 새 파일을 원래 이름으로 이동
os.rename(ico_path, png_path)

print("Icon converted successfully!")