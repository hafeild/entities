import json
import sys


if len(sys.argv) < 2:
    sys.stderr.write('Too few arguments.\n\n'+
        'Usage: extract-participant-credentials.py <study config file>\n\n')
    sys.exit()

config = json.load(open(sys.argv[1]))

for participant in config[0]['participants']:
    print(f"Username/participant id:  {participant['username']}")
    print(f"Password:                 {participant['password']}")
    print('\n')