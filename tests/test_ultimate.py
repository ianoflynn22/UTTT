import pytest

from game.ultimate import UltimateGame


def test_ultimate_3x3_has_nine_local_boards():
    game = UltimateGame(3)

    assert len(game.local_boards) == 9


def test_ultimate_3x3_local_boards_are_3x3():
    game = UltimateGame(3)

    assert all(board.size == 3 for board in game.local_boards)


def test_ultimate_3x3_has_3x3_meta_board():
    game = UltimateGame(3)

    assert game.meta_board.size == 3


def test_ultimate_4x4_has_sixteen_local_boards():
    game = UltimateGame(4)

    assert len(game.local_boards) == 16


def test_ultimate_4x4_local_boards_are_4x4():
    game = UltimateGame(4)

    assert all(board.size == 4 for board in game.local_boards)


def test_ultimate_4x4_has_4x4_meta_board():
    game = UltimateGame(4)

    assert game.meta_board.size == 4


def test_ultimate_game_starts_with_x():
    game = UltimateGame(3)

    assert game.current_player == "X"


def test_ultimate_game_starts_without_a_winner():
    game = UltimateGame(3)

    assert game.winner is None
    assert game.game_over is False


def test_ultimate_game_starts_without_target_board():
    game = UltimateGame(3)

    assert game.target_board is None

def test_parse_ultimate_move():
    game = UltimateGame(3)

    assert game.parse_move("5.7") == (4, 6)

def test_parse_ultimate_plus_move():
    game = UltimateGame(4)

    assert game.parse_move("16.16") == (15, 15)

def test_parse_move_rejects_missing_dot():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="format"):
        game.parse_move("57")

def test_parse_move_rejects_board_zero():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Board number is out of range"):
        game.parse_move("0.1")

def test_parse_move_rejects_board_too_large():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Board number is out of range"):
        game.parse_move("10.1")

def test_parse_move_rejects_cell_zero():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Cell number is out of range"):
        game.parse_move("1.0")

def test_parse_move_rejects_cell_too_large():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Cell number is out of range"):
        game.parse_move("1.10")

def test_first_move_can_be_in_any_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    assert game.local_boards[4].cells[6] == "X"

def test_first_move_sets_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    assert game.target_board == 6

def test_first_move_switches_to_o():
    game = UltimateGame(3)

    game.make_move("5.7")

    assert game.current_player == "O"

def test_second_player_must_play_in_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    with pytest.raises(
        ValueError,
        match="You must play in the target board",
    ):
        game.make_move("3.1")

def test_second_player_can_play_in_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")
    game.make_move("7.1")

    assert game.local_boards[6].cells[0] == "O"

def test_second_move_sets_next_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")
    game.make_move("7.1")

    assert game.target_board == 0

def test_local_board_winner_is_recorded():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "X")
    board.make_move(1, "X")
    board.make_move(2, "X")

    game.update_local_board(4)

    assert game.completed_boards[4] == "X"

def test_local_board_o_winner_is_recorded():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "O")
    board.make_move(3, "O")
    board.make_move(6, "O")

    game.update_local_board(4)

    assert game.completed_boards[4] == "O"

def test_unfinished_local_board_has_no_winner():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "X")
    board.make_move(1, "X")

    game.update_local_board(4)

    assert game.completed_boards[4] is None