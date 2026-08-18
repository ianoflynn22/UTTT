from game.game import Game
from game.rules import GameRules


def choose_game():
    print("Choose a game:")
    print("1. Tic-Tac-Toe")
    print("2. Tic-Tac-Toe Plus")

    choice = input("Enter your choice: ")

    if choice == "1":
        return GameRules.tic_tac_toe()

    if choice == "2":
        return GameRules.tic_tac_toe_plus()

    raise ValueError("Invalid choice")


def display_board(game):
    board = game.board
    size = board.size
    width = len(str(size * size))

    for row in range(size):
        row_values = []

        for column in range(size):
            position = row * size + column
            display_position = position + 1
            cell = board.cells[position]

            if cell is None:
                row_values.append(f"{display_position:>{width}}")
            else:
                row_values.append(f"{cell:>{width}}")

        print(" | ".join(row_values))

        if row < size - 1:
            separator = "-+-".join("-" * width for _ in range(size))
            print(separator)

def get_player_move(game):
    while True:
        try:
            position = int(input("Choose a position: ")) - 1
            game.make_move(position)
            return
        except ValueError as error:
            print(f"Invalid move: {error}")


rules = choose_game()
game = Game(rules)
print("Plus enabled:", game.rules.plus_enabled)

while not game.game_over:
    print()
    display_board(game)
    print()
    print(f"Player {game.current_player}'s turn")
    print(f"Plus symbols used: {game.plus_count}/{game.rules.max_plus}")

    get_player_move(game)

print()
display_board(game)

if game.winner:
    print(f"Player {game.winner} wins!")
else:
    print("It's a draw!")