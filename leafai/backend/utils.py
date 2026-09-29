import re

CONFIDENCE_THRESHOLD = 70.0

def clean_text(text):
    return text.replace("_", " ").replace(",", " ").replace("(", " ").replace(")", " ").strip().lower()

def split_class_label(class_label):
    if "___" in class_label:
        plant, disease = class_label.split("___", 1)
    else:
        plant, disease = class_label, "unknown"
    return plant, disease

def normalize_plant_name(raw_plant):
    plant = clean_text(raw_plant)
    
    mapping = {
        "cherry including sour": "cherry",
        "corn maize": "corn",
        "pepper bell": "pepper bell",
        "pepper  bell": "pepper bell",
        "apple": "apple",
        "blueberry": "blueberry",
        "grape": "grape",
        "orange": "orange",
        "peach": "peach",
        "potato": "potato",
        "raspberry": "raspberry",
        "soybean": "soybean",
        "squash": "squash",
        "strawberry": "strawberry",
        "tomato": "tomato"
    }
    
    return mapping.get(plant, plant)

def normalize_disease_name(raw_disease):
    disease = clean_text(raw_disease)
    
    mapping = {
        "apple scab": "apple scab",
        "black rot": "black rot",
        "cedar apple rust": "cedar apple rust",
        "powdery mildew": "powdery mildew",
        "cercospora leaf spot gray leaf spot": "gray leaf spot",
        "common rust": "common rust",
        "northern leaf blight": "leaf blight",
        "esca black measles": "esca",
        "leaf blight isariopsis leaf spot": "leaf blight",
        "haunglongbing citrus greening": "huanglongbing",
        "bacterial spot": "bacterial spot",
        "early blight": "early blight",
        "late blight": "late blight",
        "leaf scorch": "leaf scorch",
        "leaf mold": "leaf mold",
        "septoria leaf spot": "septoria leaf spot",
        "spider mites two spotted spider mite": "spider mites",
        "target spot": "target spot",
        "tomato yellow leaf curl virus": "yellow leaf curl virus",
        "tomato mosaic virus": "mosaic virus",
        "healthy": "healthy"
    }
    
    return mapping.get(disease, disease)

def get_top_predictions(predictions, class_names, top_k=3):
    indexed = list(enumerate(predictions[0]))
    indexed.sort(key=lambda x: x[1], reverse=True)
    
    top_results = []
    for idx, score in indexed[:top_k]:
        label = class_names[idx]
        plant_raw, disease_raw = split_class_label(label)
        top_results.append({
            "label": label,
            "class_name": label.replace("___", " ").replace("_", " "),
            "plant": normalize_plant_name(plant_raw),
            "disease": normalize_disease_name(disease_raw),
            "confidence": round(float(score) * 100, 2)
        })
    
    return top_results

def is_confident_prediction(confidence):
    return confidence >= CONFIDENCE_THRESHOLD