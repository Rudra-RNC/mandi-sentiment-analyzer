"""
generate_dataset.py
--------------------
Builds a starter labeled dataset for the mandi feedback sentiment model.

Usage:
    python generate_dataset.py [--out data/mandi_feedback_dataset.csv] [--seed 42]
"""
import argparse
import csv
import itertools
import random
from datetime import datetime, timedelta

PRODUCE = [
    "tomatoes", "onions", "potatoes", "wheat", "rice", "spinach", "mangoes", "chillies", "cotton", "sugarcane", "cauliflower", "brinjal", "garlic", "ginger", "bananas",
]

BUYERS = [
    "Ramesh Traders", "Sunita Agro", "Om Vegetables", "Krishna Foods", "Patel Trading Co", "Green Basket", "Bansal Traders", "Mehta Foods", "Sharma & Sons", "Gupta Wholesale", "Verma Produce", "Singh Traders",
]

# TEMPLATES[tag][sentiment] -> list of template strings.
# {produce} and {buyer} are filled in during generation.
TEMPLATES = {
    "price": {
        "positive": [
            "Fair price for the {produce} this week, good value for money.",
            "{buyer} offered a sasta rate on {produce}, very happy with the deal.",
            "Price of {produce} was reasonable and matched the market rate.",
            "Got a good rate for {produce}, no complaints on pricing.",
            "Accha rate mila for {produce}, khush hoon with the price.",
            "Best price offered this season for {produce}, sasta aur accha both.",
            "Rate was fair compared to other mandis for {produce}.",
            "Pricing was honest and transparent for {produce} this time.",
            "{buyer} gave a competitive price on {produce}, satisfied with the deal.",
            "Good rate, timely negotiation, price felt just right for {produce}.",
        ],
        "negative": [
            "Rate for {produce} felt too high, overpriced compared to last week.",
            "Price suddenly increased for {produce}, feels unfair to regular buyers.",
            "{buyer} quoted a mehenga rate for {produce}, not acceptable.",
            "Kharab rate mila for {produce}, bekar deal compared to last season.",
            "Price of {produce} is too expensive this week, disappointed with the rate.",
            "Rate is too mehenga compared to nearby mandi for {produce}.",
            "Felt cheated on the price of {produce}, rate was unfair.",
            "{buyer} charged more than market rate for {produce}, unhappy with pricing.",
            "Price dropped suddenly for {produce} without any warning, unfair.",
            "Overpriced {produce} this week, rate does not match quality.",
        ],
        "neutral": [
            "Price for {produce} was about the same as last week, nothing special.",
            "Standard rate for {produce}, average pricing this time.",
            "Rate for {produce} was okay, neither great nor bad.",
            "{buyer} offered the usual market rate for {produce}.",
            "Price stayed steady for {produce} this week.",
        ],
    },
    "quality": {
        "positive": [
            "Fresh {produce}, good quality, will buy again from {buyer}.",
            "Accha maal tha, {produce} was badhiya quality this time.",
            "{produce} arrived clean and fresh, excellent quality overall.",
            "Best quality {produce} this season from {buyer}, superb produce.",
            "Genuine and fresh {produce}, quality was top notch.",
            "{produce} quality impressed everyone at the counter.",
            "No damage, no rot, {produce} quality was excellent this time.",
            "Very satisfied with the freshness of the {produce}.",
            "{buyer} always sends good quality {produce}, reliable seller.",
            "Taaza aur badhiya {produce}, quality bilkul sahi tha.",
        ],
        "negative": [
            "{produce} was half rotten on arrival, very poor quality.",
            "Kharab maal mila, {produce} quality is not acceptable.",
            "{produce} was stale and damaged during transport.",
            "Low quality {produce} this time, many pieces were spoiled.",
            "{buyer} sent damaged {produce}, quality was terrible.",
            "Bekar quality {produce}, will think twice before buying again.",
            "{produce} had visible mold, quality was completely unacceptable.",
            "Ganda maal tha, {produce} quality bahut kharab this time.",
            "Quality of {produce} has dropped a lot compared to before.",
            "Many {produce} pieces were bruised and unfit for sale.",
        ],
        "neutral": [
            "{produce} quality was average, nothing special to report.",
            "Standard batch of {produce}, as expected this season.",
            "{produce} was okay, some pieces good some average.",
            "Quality of {produce} matched what was promised, nothing more.",
            "{buyer} delivered a typical batch of {produce} this week.",
        ],
    },
    "quantity": {
        "positive": [
            "Full weight delivered for {produce}, no shortfall at all.",
            "Correct weight and well packed {produce}, very satisfied.",
            "{buyer} always gives accurate weight for {produce}, trustworthy.",
            "Weighing was honest for {produce}, no complaints on quantity.",
            "Bag of {produce} had exact weight as agreed, good dealing.",
            "No shortage in {produce} quantity, very reliable this time.",
            "{produce} quantity was spot on, appreciate the honest weighing.",
        ],
        "negative": [
            "Short weight again on {produce}, bag was underweight by a few kilos.",
            "{buyer} gave underweight {produce}, very disappointed with the shortfall.",
            "Bag of {produce} was short by two kilos, unfair weighing.",
            "Quantity of {produce} did not match what was agreed, felt cheated.",
            "Scale seemed off, {produce} weight was less than promised.",
            "Consistently getting short weight on {produce} from this counter.",
            "{produce} delivery was short, missing almost half a bag.",
        ],
        "neutral": [
            "Weight of {produce} was roughly as expected, nothing unusual.",
            "Quantity delivered for {produce} matched the order, standard.",
            "{produce} weight seemed fine, did not check closely.",
        ],
    },
    "service": {
        "positive": [
            "Timely delivery and honest dealing from {buyer}, trustworthy service.",
            "Prompt payment for {produce}, smooth transaction as always.",
            "{buyer} staff were polite and quick at the weighing counter.",
            "Very professional service while selling {produce} this week.",
            "Payment came on time for {produce}, appreciate the reliability.",
            "{buyer} handled the {produce} pickup smoothly and on schedule.",
            "Courteous behaviour and fast processing for {produce} sale.",
        ],
        "negative": [
            "Payment delayed by three days for {produce}, very disappointed.",
            "Rude behaviour at the weighing counter while selling {produce}.",
            "{buyer} was slow and disorganized handling the {produce} sale.",
            "Had to wait for hours to sell {produce}, poor service.",
            "{buyer} refused to pay on time for {produce}, unhappy experience.",
            "Staff were impolite and dismissive during the {produce} sale.",
            "Service was chaotic and disrespectful at the {produce} counter.",
        ],
        "neutral": [
            "Service was okay while selling {produce}, nothing memorable.",
            "{buyer} processed the {produce} sale as usual, no issues.",
            "Standard service this week for {produce}, average experience.",
        ],
    },
    "other": {
        "positive": [
            "Overall a good experience selling {produce} to {buyer} this week.",
            "Happy with how the {produce} deal went overall.",
            "{buyer} is a reliable partner for {produce}, will continue working with them.",
            "Smooth process from start to finish for the {produce} sale.",
        ],
        "negative": [
            "Overall disappointed with how the {produce} deal was handled.",
            "Won't be selling {produce} to {buyer} again after this experience.",
            "The whole {produce} transaction felt unfair from start to finish.",
            "Not happy with this batch of {produce}, several issues overall.",
        ],
        "neutral": [
            "Received the {produce} delivery, order was fulfilled as per agreement.",
            "Standard transaction for {produce}, nothing to report either way.",
            "{buyer} completed the {produce} order as usual this week.",
        ],
    },
}


def build_rows(seed):
    rng = random.Random(seed)
    rows = []
    for tag, by_sentiment in TEMPLATES.items():
        for sentiment, templates in by_sentiment.items():
            for template in templates:
                # pair each template with several produce/buyer combinations
                # so the model sees each phrasing in more than one context
                combos = list(itertools.product(PRODUCE, BUYERS))
                rng.shuffle(combos)
                for produce, buyer in combos[:6]:
                    comment = template.format(produce=produce, buyer=buyer)
                    days_ago = rng.randint(0, 89)
                    date = (datetime.today() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                    rows.append(
                        {
                            "date": date,
                            "buyer": buyer,
                            "tag": tag,
                            "comment": comment,
                            "sentiment": sentiment,
                        }
                    )
    rng.shuffle(rows)
    return rows


def main():
    parser = argparse.ArgumentParser(description="Generate the mandi feedback starter dataset.")
    parser.add_argument("--out", default="data/mandi_feedback_dataset.csv")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows = build_rows(args.seed)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "buyer", "tag", "comment", "sentiment"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} labeled rows to {args.out}")
    counts = {}
    for r in rows:
        counts[r["sentiment"]] = counts.get(r["sentiment"], 0) + 1
    print("Class balance:", counts)


if __name__ == "__main__":
    main()
