FROM ruby:2.7.4-alpine3.14

RUN apk update \
  && apk upgrade \
  && apk add --no-cache g++ musl-dev make

RUN mkdir -p /app

COPY Gemfile /app
COPY Gemfile.lock /app

WORKDIR /app
RUN bundle install --jobs=4 --retry=10

CMD ["bundle", "exec", "rackup", "-s", "puma", "-E", "deployment"]
