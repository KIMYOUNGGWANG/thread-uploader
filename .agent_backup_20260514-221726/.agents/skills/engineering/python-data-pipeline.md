---
name: python-data-pipeline
description: Python 데이터 분석 파이프라인 — EDA, 전처리, 시각화, 통계 분석
tags: [python, pandas, numpy, matplotlib, sklearn, data-analysis, eda]
---

# Python Data Pipeline Skill

## 표준 프로젝트 구조

```
project/
  data/
    raw/           # 원본 데이터 (절대 수정 금지)
    processed/     # 전처리된 데이터
    outputs/       # 분석 결과 CSV
  notebooks/       # 탐색용 Jupyter (프로토타입)
  src/
    ingest.py      # 데이터 로딩
    preprocess.py  # 전처리 함수들
    analyze.py     # 분석 로직
    visualize.py   # 차트 생성
  docs/
    data-spec.md   # 데이터 컨트랙트
    analysis-report.md
  requirements.txt
```

## EDA 체크리스트

```python
import pandas as pd
import numpy as np

def run_eda(df: pd.DataFrame, name: str) -> dict:
    """기초 EDA — 모든 분석의 첫 단계."""
    report = {
        "shape": df.shape,
        "dtypes": df.dtypes.to_dict(),
        "null_counts": df.isnull().sum().to_dict(),
        "null_pct": (df.isnull().mean() * 100).round(2).to_dict(),
        "duplicates": df.duplicated().sum(),
        "stats": df.describe().to_dict(),
    }
    print(f"[EDA] {name}: {df.shape[0]:,}행 × {df.shape[1]}열")
    print(f"  결측치: {df.isnull().sum().sum():,}개")
    print(f"  중복행: {report['duplicates']:,}개")
    return report
```

## 전처리 패턴

```python
def handle_missing(df: pd.DataFrame, strategy: dict) -> pd.DataFrame:
    """결측치 처리 — 컬럼별 전략 적용."""
    result = df.copy()
    for column, method in strategy.items():
        if method == "drop":
            result = result.dropna(subset=[column])
        elif method == "mean":
            result[column] = result[column].fillna(result[column].mean())
        elif method == "median":
            result[column] = result[column].fillna(result[column].median())
        elif method == "mode":
            result[column] = result[column].fillna(result[column].mode()[0])
        elif isinstance(method, (int, float, str)):
            result[column] = result[column].fillna(method)
    return result


def normalize(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Min-Max 정규화 — train fit 후 test에 transform만."""
    result = df.copy()
    for column in columns:
        col_min = result[column].min()
        col_max = result[column].max()
        result[column] = (result[column] - col_min) / (col_max - col_min)
    return result
```

## 시각화 패턴

```python
import matplotlib.pyplot as plt
import seaborn as sns

def save_distribution_plots(df: pd.DataFrame, output_dir: str) -> None:
    """수치형 컬럼 분포 차트 일괄 저장."""
    numeric_cols = df.select_dtypes(include=np.number).columns
    for column in numeric_cols:
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        axes[0].hist(df[column].dropna(), bins=30, edgecolor="black")
        axes[0].set_title(f"{column} — 분포")
        axes[1].boxplot(df[column].dropna())
        axes[1].set_title(f"{column} — 박스플롯")
        plt.tight_layout()
        plt.savefig(f"{output_dir}/{column}_dist.png", dpi=150)
        plt.close()


def save_correlation_heatmap(df: pd.DataFrame, output_path: str) -> None:
    """상관관계 히트맵 저장."""
    plt.figure(figsize=(12, 10))
    sns.heatmap(
        df.select_dtypes(include=np.number).corr(),
        annot=True, fmt=".2f", cmap="coolwarm", center=0,
    )
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
```

## 데이터 컨트랙트 (docs/data-spec.md 템플릿)

```markdown
# Data Spec

## 입력 데이터
| 컬럼 | 타입 | 설명 | 결측치 허용 |
|------|------|------|------------|
| user_id | int | 사용자 고유 ID | 불가 |
| created_at | datetime | 생성 시각 | 불가 |

## 전처리 규칙
- user_id null → 행 제거
- amount null → 0으로 대체

## 출력 스키마
...
```

## requirements.txt 기본 세트

```
pandas>=2.0
numpy>=1.26
matplotlib>=3.8
seaborn>=0.13
scikit-learn>=1.4
jupyter>=1.0
openpyxl>=3.1    # Excel 입출력
python-dotenv>=1.0
```

## 핵심 규칙

- **raw 데이터 불변**: `data/raw/`는 절대 수정하지 않는다. 전처리 결과는 `data/processed/`에.
- **재현성**: 랜덤 시드 고정 (`random_state=42`). 파이프라인 전 단계 로깅.
- **Data Leak 방지**: 정규화/인코딩 fit은 train set에서만. test set은 transform만.
- **함수 분리**: 각 전처리 단계를 독립 함수로. 테스트 가능하게.
