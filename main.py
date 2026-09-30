from game.game import Game
from game.rules import GameRules
from game.ultimate import UltimateGame


def choose_game():
    print("Choose a game:")
    print("1. Tic-Tac-Toe")
    print("2. Tic-Tac-Toe Plus")
    print("3. Ultimate")

    while True:
        choice = input("Enter your choice: ")

        if choice == "1":
            return "normal", GameRules.tic_tac_toe()

        if choice == "2":
            return "normal", GameRules.tic_tac_toe_plus()

        if choice == "3":
            return "ultimate", 3

        print("Invalid choice.")


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


def display_ultimate_board(game):
    size = game.board_size

    board_width = 17
    gap = 4

    total_width = (board_width * size) + (gap * (size - 1))

    # Display meta board centred above the local board grid
    print()
    print("META BOARD".center(total_width))

    meta_lines = str(game.meta_board).splitlines()

    for line in meta_lines:
        print(line.center(total_width))

    print()

    # Display local boards
    for board_row in range(size):
        row_boards = []

        for board_column in range(size):
            board_index = board_row * size + board_column
            board = game.local_boards[board_index]

            status = game.completed_boards[board_index]

            if status == "X":
                label = f"BOARD {board_index + 1} - X WON"
            elif status == "O":
                label = f"BOARD {board_index + 1} - O WON"
            elif status == "D":
                label = f"BOARD {board_index + 1} - DRAW"
            else:
                label = f"BOARD {board_index + 1}"

            row_boards.append((label, str(board).splitlines()))

        # Board labels
        print(
            (" " * gap).join(
                f"{label:^{board_width}}"
                for label, _ in row_boards
            )
        )

        # Board contents
        for line_index in range(len(row_boards[0][1])):
            print(
                (" " * gap).join(
                    f"{lines[line_index]:^{board_width}}"
                    for _, lines in row_boards
                )
            )

        print()


def get_ultimate_move(game):
    while True:
        try:
            move = input("Choose a board.cell position: ")
            game.make_move(move)
            return
        except ValueError as error:
            print(f"Invalid move: {error}")


def play_ultimate(game):
    while not game.game_over:
        display_ultimate_board(game)

        print()
        print(f"Player {game.current_player}'s turn")

        if game.target_board is None:
            print("You may choose any available board.")
        elif game.completed_boards[game.target_board] is None:
            print(f"You must play in Board {game.target_board + 1}.")
        else:
            print("Your target board is completed.")
            print("You may choose any available board.")

        get_ultimate_move(game)

    display_ultimate_board(game)

    if game.winner is not None:
        print(f"Player {game.winner} wins!")
    else:
        print("The game is a draw!")


def get_player_move(game):
    while True:
        try:
            position = int(input("Choose a position: ")) - 1
            game.make_move(position)
            return
        except ValueError as error:
            print(f"Invalid move: {error}")


def play_game(game):
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


game_type, rules = choose_game()

if game_type == "ultimate":
    game = UltimateGame(rules)
    play_ultimate(game)
else:
    game = Game(rules)
    play_game(game)