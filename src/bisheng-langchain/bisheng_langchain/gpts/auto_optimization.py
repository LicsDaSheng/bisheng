import os
import httpx
import re
import json
from loguru import logger
from langchain_core.language_models.base import LanguageModelLike
from bisheng_langchain.gpts.prompts import ASSISTANT_PROMPT_OPT, OPENDIALOG_PROMPT, BREIF_DES_PROMPT
from bisheng_langchain.chat_models import ChatQWen
from langchain.chat_models import ChatOpenAI


def parse_markdown(input_str: str) -> str:
    match = re.search(r"```(markdown)?(.*)```", input_str, re.DOTALL)
    if match is None:
        out_str = input_str
    else:
        out_str = match.group(2)

    out_str = out_str.strip()
    out_str = out_str.replace('```', '')
    return out_str


def optimize_assistant_prompt(
    llm: LanguageModelLike,
    assistant_name: str, 
    assistant_description: str,
) -> str:
    """optimize assistant prompt

    Args:
        llm (LanguageModelLike): 
        assistant_name (str): 
        assistant_description (str): 

    Returns:
        assistant_prompt(str): 
    """
    chain = (
        {
            'assistant_name': lambda x: x['assistant_name'],
            'assistant_description': lambda x: x['assistant_description'],
        }
        | ASSISTANT_PROMPT_OPT
        | llm
    )
    chain_output = chain.invoke(
            {
                'assistant_name': assistant_name,
                'assistant_description': assistant_description,
            }
    )
    response = chain_output.content
    assistant_prompt = parse_markdown(response)
    return assistant_prompt


def generate_opening_dialog(
    llm: LanguageModelLike,
    description: str,
) -> str:
    chain = (
        {
            'description': lambda x: x['description'],
        }
        | OPENDIALOG_PROMPT
        | llm
    )
    time = 0
    while time <= 3:
        try:
            chain_output = chain.invoke(
                {
                    'description': description,
                }
            )
            output = json.loads(chain_output.content)
            opening_lines = output[0]["开场白"]
            questions = output[0]["问题"]
            break
        except Exception as e:
            logger.info(f"第{time}次解析失败, 错误信息: {e}")
            logger.info(f"模型输出结果为{output}。")
            time += 1
            opening_lines = ''
            questions = []

    res = {}
    res["opening_lines"] = opening_lines
    res["questions"] = questions

    return res


def generate_breif_description(
    llm: LanguageModelLike,
    description: str,
) -> str:
    chain = (
        {
            'description': lambda x: x['description'],
        }
        | BREIF_DES_PROMPT
        | llm
    )
    chain_output = chain.invoke(
        {
            'description': description,
        }
    )
    breif_description = chain_output.content
    breif_description = breif_description.strip()
    return breif_description


if __name__ == "__main__":
    httpx_client = httpx.Client(proxies=os.getenv('OPENAI_PROXY'))
    llm = ChatOpenAI(model='gpt-3.5-turbo-1106', temperature=0.01, http_client=httpx_client)
    # llm = ChatQWen(model="qwen1.5-72b-chat", temperature=0.01, api_key=os.getenv('QWEN_API_KEY'))
    assistant_name = '旅行助手'
    assistant_description = '1、帮助用户查询旅行信息；2、指定相关的旅行计划和攻略；3、提供旅行中的实时信息。'
    assistant_prompt = optimize_assistant_prompt(llm, assistant_name, assistant_description)
    # print(assistant_prompt)

    # opening_dialog = generate_opening_dialog(llm, assistant_prompt)
    # print(opening_dialog)

    breif_description = generate_breif_description(llm, assistant_prompt)
    print(breif_description)

