# to-do:
# separate conditions for state, language, gender
# shuffle
# cosine-similarity

import pandas as pd
import numpy as np

# all columns
cols = [
    "_id",
    "username",
    "name",
    "phone",
    "type",
    "gender",
    "state",
    "district",
    "city",
    "parentsnumber",
    "mentorgender",
    "school",
    "grade",
    "programming",
    "electronics",
    "medicalscience",
    "humanities",
    "commerce",
    "entrepreneurship",
    "blogging",
    "contentwriting",
    "socialwork",
    "artandpainting",
    "performancearts",
    "cookingandbaking",
    "architecture",
    "interiordesign",
    "digitalgraphics",
    "teaching",
    "law",
    "accounting",
    "sports",
    "photography",
    "threshold",
    "lang1",
    "lang2",
    "lang3",  # , 'year'
]

# columns for matrix and similarity calculation
career_cols = [
    "programming",
    "electronics",
    "medicalscience",
    "humanities",
    "commerce",
    "entrepreneurship",
    "blogging",
    "contentwriting",
    "socialwork",
    "artandpainting",
    "performancearts",
    "cookingandbaking",
    "architecture",
    "interiordesign",
    "digitalgraphics",
    "teaching",
    "law",
    "accounting",
    "sports",
    "photography",
]


def extract_rej_data(data, rej):
    d = {}
    df = pd.DataFrame()
    for obj in data:
        for col in cols:
            try:
                add_val = obj[col]
            except:
                add_val = 0
            d[col] = d.get(col, []) + [add_val]

    for k, v in d.items():
        df[k] = v

    mentor = df[df["type"] == "mentor"].reset_index(drop=True)
    mentee = df[df["type"] == "mentee"].reset_index(drop=True)

    mentee = mentee[mentee["_id"] == rej].reset_index(drop=True)
    a = str(mentee["rejected"].iloc[0])  # '['a12ard5r67', 'b'...]'
    a = a[1:-1]
    a = a.split(", ")
    a = [i[1:-1] for i in a]

    for i in a:
        idx = mentor[mentor["_id"] == i].index[0]
        mentor.drop(idx, axis=0, inplace=True)

    return mentor, mentee


# getting data and return 2 different df's
def extract_data(data):
    d = {}
    df = pd.DataFrame()
    for obj in data:
        for col in cols:
            try:
                add_val = obj[col]
            except:
                add_val = 0
            d[col] = d.get(col, []) + [add_val]

    for k, v in d.items():
        df[k] = v

    mentor = df[df["type"] == "mentor"].reset_index(drop=True)
    mentee = df[df["type"] == "mentee"].reset_index(drop=True)

    return mentor, mentee


def get_matches(data, rej=False):

    if rej:
        mentor, mentee = extract_rej_data(data, rej)
    else:
        mentor, mentee = extract_data(data)

    matches = {}
    mat = mentor[career_cols].copy()
    mat = mat.astype(int)

    for i in range(len(mentee)):
        m = mentee[career_cols].iloc[i]
        m = m.astype(int)

        mentee_index = mentee["_id"].iloc[i]
        mentee_lang = {
            mentee["lang1"].iloc[i],
            mentee["lang2"].iloc[i],
            mentee["lang3"].iloc[i],
        }

        scores = mat.dot(m)
        best_matches = list(scores.nlargest(10).index)

        flag_no_match = True
        best, best_count = 0, 0
        for match in best_matches:
            mentor_lang = {
                mentor["lang1"].iloc[match],
                mentor["lang2"].iloc[match],
                mentor["lang3"].iloc[match],
            }

            # conditions
            gender_pref = (
                mentee["mentorgender"].iloc[i] == mentor["gender"].iloc[match]
            ) or (mentee["mentorgender"].iloc[i] == "nopreference")
            state_match = mentee["state"].iloc[i] != mentor["state"].iloc[match]
            lang_match = len(mentor_lang.intersection(mentee_lang)) > 1

            conditions = gender_pref + state_match + lang_match

            flag_no_match = True
            if conditions > best_count:
                best = match
                flag_no_match = False
                best_count = conditions

        if flag_no_match:
            best = best_matches[0]

        mentor_index = mentor["_id"].iloc[best]

        # best_mentor.append(best)
        matches[mentor_index] = matches.get(mentor_index, []) + [mentee_index]

        if int(mentor["threshold"].iloc[best]) == len(matches[mentor_index]):
            mat.drop(best, axis=0, inplace=True)

    # print(matches)

    return matches
