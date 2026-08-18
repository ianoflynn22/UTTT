from game.board import Board


class UltimateGame:
    def __init__(self, board_size):
        self.board_size = board_size
        self.meta_board = Board(board_size)

        self.local_boards = [
            Board(board_size)
            for _ in range(board_size * board_size)
        ]

        self.completed_boards = [None] * (board_size * board_size)

        self.current_player = "X"
        self.winner = None
        self.game_over = False
        self.target_board = None

    def parse_move(self, move):
        try:
            board_number, cell_number = move.split(".")
            board_number = int(board_number)
            cell_number = int(cell_number)
        except (ValueError, AttributeError):
            raise ValueError("Move must be in the format board.cell")

        board_index = board_number - 1
        cell_index = cell_number - 1

        max_position = self.board_size * self.board_size

        if not 0 <= board_index < max_position:
            raise ValueError("Board number is out of range")

        if not 0 <= cell_index < max_position:
            raise ValueError("Cell number is out of range")

        return board_index, cell_index

    def make_move(self, move):
        if self.game_over:
            raise ValueError("The game is already over")

        board_index, cell_index = self.parse_move(move)

        if self.target_board is not None and board_index != self.target_board:
            raise ValueError("You must play in the target board")

        board = self.local_boards[board_index]

        board.make_move(cell_index, self.current_player)

        self.update_local_board(board_index)

        self.target_board = cell_index

        self.switch_player()

    def switch_player(self):
        if self.current_player == "X":
            self.current_player = "O"
        else:
            self.current_player = "X"

    def update_local_board(self, board_index):
        board = self.local_boards[board_index]

        winner = board.get_winner()

        if winner is not None:
            self.completed_boards[board_index] = winner