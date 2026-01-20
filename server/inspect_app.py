with open('app.py', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 90 <= i+1 <= 110:
            print(f"{i+1:3} |{line.replace(' ', '.')}", end='')
